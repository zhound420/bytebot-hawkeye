"use client";

import React, { useRef, useEffect, useState } from "react";

export function VncViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [VncComponent, setVncComponent] = useState<any>(null);

  useEffect(() => {
    // Dynamically import the VncScreen component only on the client side
    import("react-vnc").then(({ VncScreen }) => {
      setVncComponent(() => VncScreen);
    });
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full">
      {VncComponent && (
        <VncComponent
          url={process.env.NEXT_PUBLIC_VNC_URL}
          scaleViewport={true}
          viewOnly={true}
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
