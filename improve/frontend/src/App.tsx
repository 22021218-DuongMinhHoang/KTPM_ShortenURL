import { Routes, Route, Link } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  CssBaseline,
  Box,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Stats from "./pages/Stats";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Typography
              variant="h6"
              component={Link}
              to="/"
              sx={{ flexGrow: 1, textDecoration: "none", color: "inherit" }}
            >
              ShortURL
            </Typography>
            <Button color="inherit" component={Link} to="/">
              Create
            </Button>
            <Button color="inherit" component={Link} to="/dashboard">
              Dashboard
            </Button>
            <Button
              color="inherit"
              href="https://github.com/22021218-DuongMinhHoang/KTPM_ShortenURL"
              target="_blank"
            >
              GitHub
            </Button>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/stats/:id" element={<Stats />} />
          </Routes>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
