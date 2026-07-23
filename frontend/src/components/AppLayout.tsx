import { Outlet, useNavigate, useParams, NavLink as RouterNavLink } from "react-router-dom";
import { AppShell, Group, Title, Text, Button, NavLink, Stack } from "@mantine/core";
import { useAuth } from "../context/AuthContext";

const PROJECT_NAV_ITEMS = [
  { label: "Overview", path: "" },
  { label: "Explore (EDA)", path: "/eda" },
  { label: "Train", path: "/train" },
  { label: "Predict", path: "/predict" },
  { label: "Settings", path: "/settings" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={
        projectId
          ? { width: 220, breakpoint: "sm" }
          : undefined
      }
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title
            order={3}
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/projects")}
          >
            AutoML Studio
          </Title>
          <Group>
            <Text size="sm" c="dimmed">
              {user?.email}
            </Text>
            <Button variant="subtle" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      {projectId && (
        <AppShell.Navbar p="sm">
          <Stack gap={4}>
            {PROJECT_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                component={RouterNavLink}
                to={`/projects/${projectId}${item.path}`}
                label={item.label}
                end={item.path === ""}
              />
            ))}
          </Stack>
        </AppShell.Navbar>
      )}

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
