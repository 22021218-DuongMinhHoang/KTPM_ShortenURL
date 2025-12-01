import { useState } from "react";
import {
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Box,
  InputAdornment,
} from "@mui/material";
import { ContentCopy, Check, Link as LinkIcon } from "@mui/icons-material";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    originalUrl: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to shorten URL");
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const shortUrl = result ? `${window.location.origin}/short/${result.id}` : "";

  const copyToClipboard = async () => {
    if (!shortUrl) return;
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mt: 8,
      }}
    >
      <Typography
        variant="h5"
        component="h1"
        gutterBottom
        align="center"
        fontStyle="italic"
      >
        shorten links at the speed of thought.
      </Typography>

      <Card sx={{ minWidth: 275, maxWidth: 600, width: "100%", mt: 4, p: 2 }}>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              id="url"
              label="Paste your long URL"
              variant="outlined"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={
                loading && <CircularProgress size={20} color="inherit" />
              }
            >
              {loading ? "Shortening..." : "Shorten URL"}
            </Button>
          </form>

          {error && (
            <Alert severity="error" sx={{ mt: 3 }}>
              {error}
            </Alert>
          )}

          {result && (
            <Box sx={{ mt: 4, p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                SUCCESS! YOUR SHORT LINK
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography
                  variant="h6"
                  component="a"
                  href={shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    flexGrow: 1,
                    textDecoration: "none",
                    color: "inherit",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {shortUrl}
                </Typography>
                <Button
                  variant={copied ? "contained" : "outlined"}
                  color={copied ? "success" : "primary"}
                  onClick={copyToClipboard}
                  startIcon={copied ? <Check /> : <ContentCopy />}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </Box>
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
                sx={{ mt: 1 }}
              >
                Original: {result.originalUrl}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
