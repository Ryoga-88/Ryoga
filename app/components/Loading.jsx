import React from "react";

const Loading = () => {
  const containerStyle = {
    display: "flex",
    flexWrap: "wrap",
    width: "57px",
  };

  const ballStyle = {
    backgroundColor: "#fff",
    width: "15px",
    height: "15px",
    borderRadius: "100%",
    margin: "2px",
    animation: "ball-grid-pulse 1s infinite",
  };

  return (
    <div style={containerStyle}>
      {[...Array(9)].map((_, i) => (
        <div key={i} style={ballStyle}></div>
      ))}
    </div>
  );
};

export default Loading;
