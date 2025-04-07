import React from 'react';

export function VncViewer() {
  return (
    <div className="w-3/5 border-r relative">
      <div className="h-full bg-muted/30">
        <iframe
          src="http://localhost:6081/vnc.html?host=localhost&port=6080&resize=scale&autoconnect=true"
          style={{
            width: "100%",
            height: "100vh",
            border: "none",
          }}
          allowFullScreen
        />
      </div>
    </div>
  );
}
