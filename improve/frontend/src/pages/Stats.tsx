import { useParams, Link as RouterLink } from "react-router-dom";
import useSWR from "swr";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  CircularProgress,
  Alert,
  Paper,
  Divider,
} from "@mui/material";
import {
  ArrowBack,
  Mouse,
  AccessTime,
  Public,
  Shield,
  CalendarToday,
} from "@mui/icons-material";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ClickLog {
  id: string;
  created_at: string;
  ip: string;
  ua: string;
  referrer: string;
}

interface StatsData {
  clicks: string;
  recent_clicks: ClickLog[];
}

export default function Stats() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading } = useSWR<StatsData>(
    `/api/stats/${id}`,
    fetcher
  );

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
          Failed to load stats
        </Alert>
        <Button component={RouterLink} to="/dashboard" variant="outlined">
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <Button
          component={RouterLink}
          to="/dashboard"
          startIcon={<ArrowBack />}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h4" component="h1">
            Analytics Report
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            /{id}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
          gap: 3,
          mb: 4,
        }}
      >
        <Card>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "primary.light" }}>
              <Mouse />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Clicks
              </Typography>
              <Typography variant="h5">
                {parseInt(data?.clicks || "0").toLocaleString()}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "success.light" }}>
              <AccessTime />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Last Activity
              </Typography>
              <Typography variant="h6">
                {data?.recent_clicks?.[0]
                  ? new Date(
                      data.recent_clicks[0].created_at
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "N/A"}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "info.light" }}>
              <Public />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Top Referrer
              </Typography>
              <Typography variant="h6" noWrap sx={{ maxWidth: 150 }}>
                {data?.recent_clicks?.[0]?.referrer || "Direct"}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Paper variant="outlined">
        <Box sx={{ p: 2, bgcolor: "background.default" }}>
          <Typography variant="h6">Recent Activity Log</Typography>
        </Box>
        <Divider />
        <List>
          {data?.recent_clicks?.map((log, i) => (
            <div key={i}>
              <ListItem alignItems="flex-start">
                <ListItemAvatar>
                  <Avatar>
                    <Public fontSize="small" />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={log.ip}
                  secondary={
                    <>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                      >
                        {log.ua}
                      </Typography>
                      <br />
                      <Box
                        component="span"
                        sx={{
                          display: "flex",
                          gap: 2,
                          mt: 0.5,
                          fontSize: "0.8rem",
                          color: "text.secondary",
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <Shield fontSize="inherit" /> {log.referrer}
                        </Box>
                        <Box
                          component="span"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <CalendarToday fontSize="inherit" />{" "}
                          {new Date(log.created_at).toLocaleString()}
                        </Box>
                      </Box>
                    </>
                  }
                />
              </ListItem>
              {i < (data?.recent_clicks?.length || 0) - 1 && (
                <Divider variant="inset" component="li" />
              )}
            </div>
          ))}
          {(!data?.recent_clicks || data.recent_clicks.length === 0) && (
            <ListItem>
              <ListItemText
                primary="No activity recorded yet."
                sx={{ textAlign: "center", color: "text.secondary" }}
              />
            </ListItem>
          )}
        </List>
      </Paper>
    </Box>
  );
}
