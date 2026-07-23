import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Select,
  Button,
  Badge,
  Table,
  Loader,
  Center,
  Alert,
  Stack,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { trainModels, listTrainingRuns, getTrainingRun, saveModel } from "../api/training";
import { extractErrorMessage } from "../api/client";
import { useSelectedDataset } from "../hooks/useSelectedDataset";
import TrainingResultsTable from "../components/TrainingResultsTable";

export default function TrainPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { datasetId, dataset, datasets, datasetsLoading, selectDataset } =
    useSelectedDataset(id);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const { data: runs } = useQuery({
    queryKey: ["training-runs", id, datasetId],
    queryFn: () => listTrainingRuns(id, datasetId),
    enabled: Number.isFinite(id) && Number.isFinite(datasetId),
  });

  // Default to the most recent run whenever the dataset (and therefore its
  // run history) changes, but don't fight the user's own selection.
  useEffect(() => {
    setSelectedRunId(null);
  }, [datasetId]);
  useEffect(() => {
    if (runs && runs.length > 0 && selectedRunId === null) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  const { data: selectedRun, isLoading: selectedRunLoading } = useQuery({
    queryKey: ["training-run", id, datasetId, selectedRunId],
    queryFn: () => getTrainingRun(id, datasetId, selectedRunId!),
    enabled: Number.isFinite(id) && Number.isFinite(datasetId) && !!selectedRunId,
  });

  const trainMutation = useMutation({
    mutationFn: () => trainModels(id, datasetId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["training-runs", id, datasetId] });
      setSelectedRunId(result.id);
      notifications.show({ title: "Training complete", message: "All 5 models trained", color: "green" });
    },
    onError: (err) => {
      notifications.show({ title: "Training failed", message: extractErrorMessage(err), color: "red" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: ({ runId, modelName }: { runId: number; modelName: string }) =>
      saveModel(id, datasetId, runId, modelName),
    onSuccess: (result) => {
      notifications.show({
        title: "Model saved",
        message: `${result.model_name} is now this project's production model`,
        color: "green",
      });
    },
    onError: (err) => {
      notifications.show({ title: "Save failed", message: extractErrorMessage(err), color: "red" });
    },
  });

  const activeRun = trainMutation.data ?? selectedRun;

  if (datasetsLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (datasets && datasets.length === 0) {
    return (
      <Container size="lg">
        <Alert color="yellow" title="No datasets yet">
          Upload a CSV from the project overview page first.
        </Alert>
        <Button mt="md" onClick={() => navigate(`/projects/${id}`)}>
          Back to project
        </Button>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="md">
        <Title order={2}>Train Models</Title>
        <Button variant="subtle" onClick={() => navigate(`/projects/${id}`)}>
          Back to project
        </Button>
      </Group>

      {datasets && datasets.length > 1 && (
        <Select
          label="Dataset"
          data={datasets.map((d) => ({ value: String(d.id), label: d.filename }))}
          value={String(datasetId)}
          onChange={(value) => value && selectDataset(Number(value))}
          w={300}
          mb="md"
        />
      )}

      {!dataset?.target_column ? (
        <Alert color="yellow" title="No target column set">
          Go to Explore (EDA) and choose a target column for this dataset before training.
        </Alert>
      ) : (
        <Stack gap="lg">
          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between">
              <Group>
                <Badge color="teal" size="lg">
                  Target: {dataset.target_column}
                </Badge>
                <Badge color="blue" size="lg" variant="light">
                  {dataset.problem_type?.replace("_", " ")}
                </Badge>
              </Group>
              <Button onClick={() => trainMutation.mutate()} loading={trainMutation.isPending}>
                Train Models
              </Button>
            </Group>
            {trainMutation.isPending && (
              <Text size="sm" c="dimmed" mt="sm">
                Training Logistic/Linear Regression, Random Forest, XGBoost, LightGBM, and
                CatBoost sequentially — this can take a little while.
              </Text>
            )}
          </Card>

          {runs && runs.length > 0 && (
            <Card withBorder padding="md" radius="md">
              <Text size="sm" fw={600} mb="xs">
                Past runs
              </Text>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Run</Table.Th>
                    <Table.Th>Target</Table.Th>
                    <Table.Th>Problem Type</Table.Th>
                    <Table.Th>Models</Table.Th>
                    <Table.Th>Best</Table.Th>
                    <Table.Th>Date</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {runs.map((r) => (
                    <Table.Tr
                      key={r.id}
                      style={{
                        cursor: "pointer",
                        background:
                          r.id === selectedRunId ? "var(--mantine-color-blue-0)" : undefined,
                      }}
                      onClick={() => setSelectedRunId(r.id)}
                    >
                      <Table.Td>#{r.id}</Table.Td>
                      <Table.Td>{r.target_column}</Table.Td>
                      <Table.Td>
                        <Badge variant="light">{r.problem_type.replace("_", " ")}</Badge>
                      </Table.Td>
                      <Table.Td>{r.model_count}</Table.Td>
                      <Table.Td>{r.best_model_name ?? "-"}</Table.Td>
                      <Table.Td>{new Date(r.created_at).toLocaleString()}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}

          {selectedRunLoading && !trainMutation.data && (
            <Center py="xl">
              <Loader />
            </Center>
          )}

          {activeRun && (
            <TrainingResultsTable
              run={activeRun}
              title={runs && runs.length > 1 ? `Run #${activeRun.id} results` : "Results"}
              onSave={(modelName) => saveMutation.mutate({ runId: activeRun.id, modelName })}
              savingModelName={saveMutation.isPending ? saveMutation.variables?.modelName : undefined}
            />
          )}
        </Stack>
      )}
    </Container>
  );
}
