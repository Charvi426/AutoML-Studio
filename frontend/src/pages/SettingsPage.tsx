import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Container, Title, Card, Text, Stack, Group, Loader, Center } from "@mantine/core";
import { useAuth } from "../context/AuthContext";
import { getProject } from "../api/projects";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value}
      </Text>
    </Group>
  );
}

export default function SettingsPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const { user } = useAuth();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
    enabled: Number.isFinite(id),
  });

  return (
    <Container size="sm">
      <Title order={2} mb="lg">
        Settings
      </Title>

      <Stack gap="lg">
        <Card withBorder padding="lg" radius="md">
          <Title order={4} mb="sm">
            Account
          </Title>
          <Stack gap="xs">
            <InfoRow label="Name" value={user?.name ?? "-"} />
            <InfoRow label="Email" value={user?.email ?? "-"} />
            <InfoRow
              label="Joined"
              value={user ? new Date(user.created_at).toLocaleDateString() : "-"}
            />
          </Stack>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Title order={4} mb="sm">
            Project
          </Title>
          {isLoading ? (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          ) : (
            <Stack gap="xs">
              <InfoRow label="Name" value={project?.project_name ?? "-"} />
              <InfoRow
                label="Created"
                value={project ? new Date(project.created_at).toLocaleDateString() : "-"}
              />
            </Stack>
          )}
        </Card>

        <Text size="xs" c="dimmed">
          Renaming/deleting projects and changing your password aren't available yet.
        </Text>
      </Stack>
    </Container>
  );
}
