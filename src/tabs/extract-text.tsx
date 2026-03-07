import React from "react";
import { Card, Typography } from "antd";

const { Title } = Typography;

function ExtractTextPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "20px"
    }}>
      <Card
        style={{
          maxWidth: "1200px",
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
        }}
      >
        <Title level={2} style={{ textAlign: "center", marginBottom: "24px" }}>
          Extract Text
        </Title>
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}>
          <img
            src="https://online.fliphtml5.com/oddka/BBC-Science-Focus-December-2025/files/large/c7653292808589f78db42c29090cf83b.webp"
            alt="Extracted Content"
            style={{
              maxWidth: "100%",
              height: "auto",
              borderRadius: "8px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)"
            }}
          />
        </div>
      </Card>
    </div>
  );
}

export default ExtractTextPage;
