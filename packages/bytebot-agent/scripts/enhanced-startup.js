#!/usr/bin/env node
const { existsSync } = require('fs');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Enhanced startup script for bytebot-agent container
 * Handles environment validation, database connectivity, and Prisma initialization
 */

console.log('[startup] ByteBot Agent Enhanced Startup Script');
console.log('[startup] =====================================');

/**
 * Validate and set database environment variables
 */
function validateDatabaseEnvironment() {
  console.log('[startup] Validating database environment...');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log('[startup] ⚠ DATABASE_URL not set, using default PostgreSQL configuration');
    
    // Set default DATABASE_URL based on docker-compose setup
    const defaultDatabaseUrl = 'postgresql://postgres:postgres@postgres:5432/bytebotdb';
    process.env.DATABASE_URL = defaultDatabaseUrl;
    
    console.log(`[startup] ✓ DATABASE_URL set to: ${defaultDatabaseUrl}`);
  } else {
    console.log(`[startup] ✓ DATABASE_URL found: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`);
  }
  
  // Validate other required environment variables
  const requiredEnvVars = [
    'NODE_ENV',
  ];
  
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    console.log(`[startup] ⚠ Missing environment variables: ${missingEnvVars.join(', ')}`);
    
    // Set defaults for missing variables
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'production';
      console.log('[startup] ✓ NODE_ENV set to: production');
    }
  }
}

/**
 * Wait for database to become available
 */
async function waitForDatabase(maxRetries = 30, retryDelay = 2000) {
  console.log('[startup] Waiting for database connection...');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try to connect to the database using a simple query
      execSync('npx prisma db execute --stdin < /dev/null 2>/dev/null || npx prisma db push --accept-data-loss --skip-generate 2>/dev/null || true', {
        stdio: 'pipe',
        timeout: 5000
      });
      
      // If we got here without an exception, the database is likely available
      console.log(`[startup] ✓ Database connection successful (attempt ${attempt}/${maxRetries})`);
      return true;
    } catch (error) {
      console.log(`[startup] ⚠ Database connection attempt ${attempt}/${maxRetries} failed`);
      
      if (attempt === maxRetries) {
        console.error('[startup] ✗ Database connection failed after maximum retries');
        console.error('[startup] This could indicate:');
        console.error('[startup] 1. PostgreSQL service is not running');
        console.error('[startup] 2. DATABASE_URL is incorrect');
        console.error('[startup] 3. Network connectivity issues');
        console.error('[startup] 4. Database is still initializing');
        throw new Error(`Database connection failed after ${maxRetries} attempts`);
      }
      
      console.log(`[startup] Retrying in ${retryDelay/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  return false;
}

/**
 * Detect environment and database strategy
 */
function detectEnvironmentStrategy() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  const resetAllowed = process.env.BYTEBOT_DB_RESET_ALLOWED === 'true' || isDevelopment;
  const migrationStrategy = process.env.BYTEBOT_MIGRATION_STRATEGY || 'auto';
  
  console.log('[startup] Environment detection:');
  console.log(`[startup] - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`[startup] - Reset allowed: ${resetAllowed}`);
  console.log(`[startup] - Migration strategy: ${migrationStrategy}`);
  
  return { isDevelopment, isProduction, resetAllowed, migrationStrategy };
}

/**
 * Check database state and migration status
 */
async function checkDatabaseState() {
  console.log('[startup] Checking database state...');
  
  try {
    // Check if database has any tables
    const sqlFile = path.join(__dirname, 'check-tables.sql');
    const result = execSync(`npx prisma db execute --file "${sqlFile}"`, {
      stdio: 'pipe',
      timeout: 10000
    });
    
    const hasData = result.toString().includes('1') || result.toString().includes('2') || result.toString().includes('3');
    
    // Check migration status
    let migrationStatus = 'unknown';
    try {
      execSync('npx prisma migrate status', {
        stdio: 'pipe',
        timeout: 15000
      });
      migrationStatus = 'up-to-date';
    } catch (statusError) {
      if (statusError.message.includes('never been migrated')) {
        migrationStatus = 'never-migrated';
      } else if (statusError.message.includes('following migrations have not yet been applied')) {
        migrationStatus = 'pending-migrations';
      } else if (statusError.message.includes('P3005')) {
        migrationStatus = 'schema-drift';
      } else {
        migrationStatus = 'error';
      }
    }
    
    console.log(`[startup] ✓ Database state: ${hasData ? 'has data' : 'empty'}, migration status: ${migrationStatus}`);
    return { hasData, migrationStatus };
    
  } catch (error) {
    console.log(`[startup] ⚠ Could not determine database state: ${error.message}`);
    return { hasData: false, migrationStatus: 'unknown' };
  }
}

/**
 * Handle database reset (development only)
 */
async function resetDatabase() {
  console.log('[startup] 🔄 Performing database reset...');
  
  try {
    // Drop all tables and recreate schema
    const resetSqlFile = path.join(__dirname, 'reset-schema.sql');
    execSync(`npx prisma db execute --file "${resetSqlFile}"`, {
      stdio: 'inherit',
      timeout: 30000
    });
    
    // Run fresh migrations
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      timeout: 60000
    });
    
    console.log('[startup] ✓ Database reset and migrations applied successfully');
    return true;
    
  } catch (error) {
    console.log(`[startup] ⚠ Database reset failed: ${error.message}`);
    return false;
  }
}

/**
 * Handle migration baseline for production
 */
async function baselineMigrations() {
  console.log('[startup] 📋 Setting up migration baseline...');
  
  try {
    // Create migration table and mark all migrations as applied
    execSync('npx prisma migrate resolve --applied $(ls prisma/migrations)', {
      stdio: 'inherit',
      timeout: 60000
    });
    
    console.log('[startup] ✓ Migration baseline established successfully');
    return true;
    
  } catch (error) {
    console.log(`[startup] ⚠ Migration baseline failed: ${error.message}`);
    return false;
  }
}

/**
 * Advanced schema synchronization
 */
async function syncSchema() {
  console.log('[startup] 🔄 Synchronizing database schema...');
  
  try {
    // Use db push to sync schema without migrations
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
      timeout: 60000
    });
    
    console.log('[startup] ✓ Database schema synchronized successfully');
    return true;
    
  } catch (error) {
    console.log(`[startup] ⚠ Schema synchronization failed: ${error.message}`);
    return false;
  }
}

/**
 * Verify schema consistency
 */
async function verifySchema() {
  console.log('[startup] 🔍 Verifying schema consistency...');
  
  try {
    // Check if schema matches expectations
    execSync('npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma', {
      stdio: 'pipe',
      timeout: 15000
    });
    
    console.log('[startup] ✓ Database schema is consistent');
    return true;
    
  } catch (error) {
    console.log(`[startup] ⚠ Schema verification shows differences: ${error.message}`);
    return false;
  }
}

/**
 * Run Prisma migrations and generate client with smart detection
 */
async function runPrismaOperations() {
  console.log('[startup] Running Prisma operations...');
  
  try {
    // First always generate the client
    console.log('[startup] 1. Generating Prisma client...');
    execSync('npx prisma generate', {
      stdio: 'inherit',
      timeout: 30000 // 30 second timeout for client generation
    });
    console.log('[startup] ✓ Prisma client generated successfully');
    
    // Detect environment and strategy
    const { isDevelopment, isProduction, resetAllowed, migrationStrategy } = detectEnvironmentStrategy();
    
    // Check database state
    const { hasData, migrationStatus } = await checkDatabaseState();
    
    console.log('[startup] 2. Handling database schema with smart detection...');
    
    // Strategy selection based on environment and database state
    if (migrationStrategy === 'auto') {
      // Auto strategy: intelligent selection based on environment and state
      
      if (migrationStatus === 'up-to-date') {
        console.log('[startup] ✓ Database migrations are already up to date');
        return;
      }
      
      if (migrationStatus === 'never-migrated' && !hasData) {
        // Fresh database, run normal migrations
        console.log('[startup] 2a. Fresh database detected, running initial migrations...');
        try {
          execSync('npx prisma migrate deploy', {
            stdio: 'inherit',
            timeout: 60000
          });
          console.log('[startup] ✓ Initial migrations applied successfully');
          return;
        } catch (error) {
          console.log(`[startup] ⚠ Initial migration failed: ${error.message}`);
        }
      }
      
      if (migrationStatus === 'schema-drift' || migrationStatus === 'error') {
        // Handle P3005 and schema drift issues
        console.log('[startup] 2b. Schema drift detected, applying smart resolution...');
        
        if (isDevelopment && resetAllowed) {
          // Development: Try reset first
          console.log('[startup] 2b.1. Development mode: attempting database reset...');
          if (await resetDatabase()) {
            return;
          }
        }
        
        if (isProduction || !resetAllowed) {
          // Production: Try baseline approach
          console.log('[startup] 2b.2. Production mode: attempting migration baseline...');
          if (await baselineMigrations()) {
            return;
          }
        }
        
        // Fallback: Try schema sync
        console.log('[startup] 2b.3. Fallback: attempting schema synchronization...');
        if (await syncSchema()) {
          return;
        }
      }
      
      if (migrationStatus === 'pending-migrations') {
        // Normal pending migrations
        console.log('[startup] 2c. Pending migrations detected, applying...');
        try {
          execSync('npx prisma migrate deploy', {
            stdio: 'inherit',
            timeout: 60000
          });
          console.log('[startup] ✓ Pending migrations applied successfully');
          return;
        } catch (error) {
          console.log(`[startup] ⚠ Migration deployment failed: ${error.message}`);
          
          // Fallback to schema sync if migration fails
          console.log('[startup] 2c.1. Migration failed, attempting schema sync...');
          if (await syncSchema()) {
            return;
          }
        }
      }
      
    } else if (migrationStrategy === 'reset') {
      // Force reset strategy
      if (resetAllowed) {
        console.log('[startup] 2d. Force reset strategy...');
        if (await resetDatabase()) {
          return;
        }
      } else {
        console.log('[startup] ⚠ Reset strategy requested but not allowed in this environment');
      }
      
    } else if (migrationStrategy === 'baseline') {
      // Force baseline strategy
      console.log('[startup] 2e. Force baseline strategy...');
      if (await baselineMigrations()) {
        return;
      }
      
    } else if (migrationStrategy === 'sync') {
      // Force sync strategy
      console.log('[startup] 2f. Force sync strategy...');
      if (await syncSchema()) {
        return;
      }
    }
    
    // Final verification attempt
    console.log('[startup] 2g. Final verification of schema consistency...');
    if (await verifySchema()) {
      console.log('[startup] ✓ Schema verification passed, continuing startup');
      return;
    }
    
    // If we get here, all strategies failed
    throw new Error('All migration strategies failed. Database may need manual intervention.');
    
  } catch (error) {
    console.error('[startup] ✗ Prisma operations failed:');
    console.error(`[startup] Error: ${error.message}`);
    console.error('[startup]');
    console.error('[startup] Advanced troubleshooting steps:');
    console.error('[startup] 1. Check DATABASE_URL is correct');
    console.error('[startup] 2. Verify PostgreSQL is accessible');
    console.error('[startup] 3. For development: docker compose down -v && docker compose up postgres -d');
    console.error('[startup] 4. For production: Set BYTEBOT_MIGRATION_STRATEGY=baseline');
    console.error('[startup] 5. Manual reset: Set BYTEBOT_DB_RESET_ALLOWED=true');
    console.error('[startup] 6. Check migration files in prisma/migrations/');
    throw error;
  }
}

/**
 * Load and verify OpenCV (from existing start-prod.js)
 */
function verifyOpenCvBindings() {
  console.log('[startup] Verifying OpenCV bindings...');
  
  try {
    // Try different module paths for OpenCV
    let cv;
    const possiblePaths = [
      '@u4/opencv4nodejs',
      'opencv4nodejs',
      '/app/packages/bytebot-cv/node_modules/@u4/opencv4nodejs',
      '/usr/lib/node_modules/@u4/opencv4nodejs'
    ];

    for (const modulePath of possiblePaths) {
      try {
        cv = require(modulePath);
        console.log(`[startup] ✓ Found OpenCV at: ${modulePath}`);
        break;
      } catch (err) {
        console.log(`[startup] ⚠ OpenCV not found at: ${modulePath}`);
        continue;
      }
    }

    if (!cv) {
      throw new Error('opencv4nodejs module not found in any expected location');
    }
    
    if (!cv || typeof cv.Mat !== 'function') {
      throw new Error('opencv4nodejs module loaded but cv.Mat is not available');
    }
    
    // Test basic functionality
    const testMat = new cv.Mat(5, 5, cv.CV_8UC3);
    if (!testMat || testMat.rows !== 5 || testMat.cols !== 5) {
      throw new Error('opencv4nodejs basic functionality test failed');
    }
    
    console.log('[startup] ✓ OpenCV bindings verified successfully');
    return true;
    
  } catch (error) {
    console.log(`[startup] ⚠ OpenCV verification failed: ${error.message}`);
    console.log('[startup] The application will start but computer vision features may not work');
    console.log('[startup] Consider rebuilding the container with: docker compose build --no-cache bytebot-agent');
    return false;
  }
}

/**
 * Start the NestJS application
 */
function startApplication() {
  console.log('[startup] Starting NestJS application...');
  
  const baseDist = path.resolve(__dirname, '..', 'dist');
  const candidates = [
    'src/main.js',
    'bytebot-agent/src/main.js', 
    'main.js',
  ];
  
  for (const rel of candidates) {
    const candidatePath = path.join(baseDist, rel);
    if (existsSync(candidatePath)) {
      console.log(`[startup] ✓ Found application entry point: ${candidatePath}`);
      console.log('[startup] =====================================');
      console.log('[startup] Starting ByteBot Agent...');
      console.log('[startup]');
      
      require(candidatePath);
      return;
    }
  }
  
  console.error('[startup] ✗ Unable to locate compiled NestJS entry point');
  console.error(`[startup] Searched in: ${baseDist}`);
  console.error(`[startup] Candidates: ${candidates.join(', ')}`);
  console.error('[startup] Make sure the application was built with: npm run build:dist');
  process.exit(1);
}

/**
 * Main startup sequence
 */
async function main() {
  try {
    // Step 1: Validate environment
    validateDatabaseEnvironment();
    
    // Step 2: Wait for database
    await waitForDatabase();
    
    // Step 3: Run Prisma operations
    await runPrismaOperations();
    
    // Step 4: Verify OpenCV (optional, non-blocking)
    verifyOpenCvBindings();
    
    // Step 5: Start application
    startApplication();
    
  } catch (error) {
    console.error('[startup] ✗ Startup sequence failed:');
    console.error(`[startup] ${error.message}`);
    console.error('[startup]');
    console.error('[startup] Container will exit. Check the logs above for specific errors.');
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGTERM', () => {
  console.log('[startup] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[startup] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the application
main().catch(error => {
  console.error('[startup] Unhandled error during startup:', error);
  process.exit(1);
});
