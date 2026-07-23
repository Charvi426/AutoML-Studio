import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  Badge,
  Button,
  Loader,
  Center,
  Alert,
  FileButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { listDatasets, uploadDataset } from "../api/datasets";
import { getProject } from "../api/projects";
import { extractErrorMessage } from "../api/client";

export default function ProjectOverviewPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  });

  const {
    data: datasets,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["datasets", id],
    queryFn: () => listDatasets(id),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadDataset(id, file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["datasets", id] });
      notifications.show({
        title: "Dataset uploaded",
        message: `${result.filename}: ${result.rows} rows, ${result.columns} columns`,
        color: "green",
      });
    },
    onError: (err) => {
      notifications.show({ title: "Upload failed", message: extractErrorMessage(err), color: "red" });
    },
  });

  return (
    <Container size="lg">
      <Title order={2} mb="xs">
        {project?.project_name ?? "Project"}
      </Title>
      <Text c="dimmed" mb="lg">
        Upload a dataset to get started, then explore, train, and predict.
      </Text>

      <Group mb="lg">
        <FileButton onChange={(file) => file && uploadMutation.mutate(file)} accept=".csv">
          {(props) => (
            <Button {...props} loading={uploadMutation.isPending}>
              Upload CSV
            </Button>
          )}
        </FileButton>
      </Group>

      {isLoading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}

      {error && <Alert color="red">{extractErrorMessage(error)}</Alert>}

      {datasets && datasets.length === 0 && (
        <Text c="dimmed">No datasets uploaded yet.</Text>
      )}

      <Stack gap="sm">
        {datasets?.map((dataset) => (
          <Card key={dataset.id} withBorder padding="md" radius="md">
            <Group justify="space-between">
              <div>
                <Text fw={600}>{dataset.filename}</Text>
                <Text size="xs" c="dimmed">
                  {dataset.rows} rows &middot; {dataset.columns} columns &middot; uploaded{" "}
                  {new Date(dataset.uploaded_at).toLocaleString()}
                </Text>
                <Group gap="xs" mt={6}>
                  {dataset.target_column ? (
                    <Badge color="teal" variant="light">
                      Target: {dataset.target_column}
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="light">
                      No target selected
                    </Badge>
                  )}
                  {dataset.problem_type && (
                    <Badge color="blue" variant="light">
                      {dataset.problem_type.replace("_", " ")}
                    </Badge>
                  )}
                </Group>
              </div>
              <Button
                variant="light"
                onClick={() => navigate(`/projects/${id}/eda?dataset=${dataset.id}`)}
              >
                Explore
              </Button>
            </Group>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
