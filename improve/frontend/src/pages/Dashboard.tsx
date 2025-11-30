import { useState } from "react";
import useSWR from "swr";
import { Link as RouterLink } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Pagination,
} from "@mui/material";
import { Refresh, OpenInNew, BarChart } from "@mui/icons-material";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LinkData {
  id: string;
  url: string;
  created_at: string;
  clicks: string;
}

interface ApiResponse {
  links: LinkData[];
  hasMore: boolean;
}

export default function Dashboard() {
  const [page, setPage] = useState(1);
  const limit = 10;

  const apiUrl = `/api/links?page=${page}&limit=${limit}`;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    apiUrl,
    fetcher
  );

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          mt: 8,
        }}
      >
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load links
        </Alert>
        <Button variant="outlined" onClick={() => mutate()}>
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <IconButton onClick={() => mutate()} color="primary">
          <Refresh />
        </IconButton>
      </Box>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableHead>
            <TableRow>
              <TableCell>Link Details</TableCell>
              <TableCell>Performance</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.links?.map((link) => (
              <TableRow
                key={link.id}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  <Typography variant="subtitle2" component="div">
                    {window.location.origin}/short/{link.id}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ maxWidth: 300, display: "block" }}
                  >
                    {link.url}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${parseInt(link.clicks).toLocaleString()} clicks`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  {new Date(link.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    component="a"
                    href={`/short/${link.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                  >
                    <OpenInNew fontSize="small" />
                  </IconButton>
                  <Button
                    component={RouterLink}
                    to={`/stats/${link.id}`}
                    startIcon={<BarChart />}
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    Analytics
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data?.links?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No links created yet
                  </Typography>
                  <Button
                    component={RouterLink}
                    to="/"
                    variant="contained"
                    sx={{ mt: 2 }}
                  >
                    Create Link
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <Pagination
          count={data?.hasMore ? page + 1 : page}
          page={page}
          onChange={handlePageChange}
          color="primary"
          hideNextButton={!data?.hasMore}
        />
      </Box>
    </Box>
  );
}
