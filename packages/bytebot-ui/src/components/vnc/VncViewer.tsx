import React from "react";

export function VncViewer() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <iframe
        src="http://localhost:6081/vnc.html?host=localhost&port=6080&resize=scale&autoconnect=true&viewonly=true"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          objectFit: "contain"
        }}
        title="VNC Desktop"
      />
    </div>
  );
}
