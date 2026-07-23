import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Button,
  Badge,
  TextInput,
  Table,
  Loader,
  Center,
  Alert,
  Stack,
  Tabs,
  SimpleGrid,
  FileButton,
  Progress,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { notifications } from "@mantine/notifications";
import {
  getSavedModel,
  predictSingle,
  predictBatch,
  getPredictionHistory,
  getPredictionStats,
} from "../api/predictions";
import { extractErrorMessage } from "../api/client";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder padding="md" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {value}
      </Text>
    </Card>
  );
}

function coercePayloadValue(raw: string): string | number {
  const trimmed = raw.trim();
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  return raw;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PredictPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const {
    data: savedModel,
    isLoading: savedModelLoading,
    error: savedModelError,
  } = useQuery({
    queryKey: ["saved-model", id],
    queryFn: () => getSavedModel(id),
    enabled: Number.isFinite(id),
    retry: false,
  });

  const { data: history } = useQuery({
    queryKey: ["prediction-history", id],
    queryFn: () => getPredictionHistory(id),
    enabled: Number.isFinite(id) && !!savedModel,
  });

  const { data: stats } = useQuery({
    queryKey: ["prediction-stats", id],
    queryFn: () => getPredictionStats(id),
    enabled: Number.isFinite(id) && !!savedModel,
  });

  const predictMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | number> = {};
      for (const col of savedModel?.feature_columns ?? []) {
        payload[col] = coercePayloadValue(formValues[col] ?? "");
      }
      return predictSingle(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prediction-history", id] });
      queryClient.invalidateQueries({ queryKey: ["prediction-stats", id] });
    },
    onError: (err) => {
      notifications.show({ title: "Prediction failed", message: extractErrorMessage(err), color: "red" });
    },
  });

  const batchMutation = useMutation({
    mutationFn: (file: File) => predictBatch(id, file),
    onSuccess: (blob) => {
      downloadBlob(blob, "predictions.csv");
      queryClient.invalidateQueries({ queryKey: ["prediction-history", id] });
      queryClient.invalidateQueries({ queryKey: ["prediction-stats", id] });
      notifications.show({ title: "Batch prediction complete", message: "predictions.csv downloaded", color: "green" });
    },
    onError: (err) => {
      notifications.show({ title: "Batch prediction failed", message: extractErrorMessage(err), color: "red" });
    },
  });

  if (savedModelLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (savedModelError || !savedModel) {
    return (
      <Container size="lg">
        <Alert color="yellow" title="No saved model yet">
          Train some models and click "Save" on the one you want to use for predictions
          (Train or Experiments tab) before you can predict here.
        </Alert>
        <Button mt="md" onClick={() => navigate(`/projects/${id}/train`)}>
          Go to Train
        </Button>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="xs">
        <Title order={2}>Predict</Title>
        <Button variant="subtle" onClick={() => navigate(`/projects/${id}`)}>
          Back to project
        </Button>
      </Group>

      <Card withBorder padding="md" radius="md" mb="lg">
        <Group>
          <Badge color="teal" size="lg">
            Model: {savedModel.model_name}
          </Badge>
          <Badge color="blue" variant="light" size="lg">
            {savedModel.problem_type.replace("_", " ")}
          </Badge>
          <Badge color="gray" variant="light" size="lg">
            Target: {savedModel.target_column}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" mt={6}>
          Saved {new Date(savedModel.saved_at).toLocaleString()}
        </Text>
      </Card>

      <Tabs defaultValue="single">
        <Tabs.List>
          <Tabs.Tab value="single">Single Prediction</Tabs.Tab>
          <Tabs.Tab value="batch">Batch Prediction</Tabs.Tab>
          <Tabs.Tab value="history">History &amp; Stats</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="single" pt="md">
          <Card withBorder padding="lg" radius="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
              {savedModel.feature_columns.map((col) => (
                <TextInput
                  key={col}
                  label={col}
                  value={formValues[col] ?? ""}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setFormValues((prev) => ({ ...prev, [col]: value }));
                  }}
                />
              ))}
            </SimpleGrid>
            <Button onClick={() => predictMutation.mutate()} loading={predictMutation.isPending}>
              Predict
            </Button>

            {predictMutation.data && (
              <Card withBorder mt="md" padding="md" radius="md" bg="teal.0">
                <Text size="sm" c="dimmed">
                  Prediction
                </Text>
                <Text size="xl" fw={700}>
                  {predictMutation.data.prediction}
                </Text>
                {predictMutation.data.probability !== null && (
                  <>
                    <Text size="sm" c="dimmed" mt="xs">
                      Confidence
                    </Text>
                    <Progress value={predictMutation.data.probability * 100} size="lg" />
                    <Text size="xs" c="dimmed" mt={4}>
                      {(predictMutation.data.probability * 100).toFixed(1)}%
                    </Text>
                  </>
                )}
              </Card>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="batch" pt="md">
          <Card withBorder padding="lg" radius="md">
            <Text size="sm" c="dimmed" mb="md">
              Upload a CSV with columns: {savedModel.feature_columns.join(", ")}. You'll get
              back a predictions.csv with a prediction (and probability, if applicable) column
              added.
            </Text>
            <FileButton onChange={(file) => file && batchMutation.mutate(file)} accept=".csv">
              {(props) => (
                <Button {...props} loading={batchMutation.isPending}>
                  Upload CSV
                </Button>
              )}
            </FileButton>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <Stack gap="lg">
            {stats && (
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                <StatCard label="Total Predictions" value={stats.total_predictions} />
                <StatCard label="Most Used Model" value={stats.most_used_model ?? "-"} />
                <StatCard
                  label="Avg Confidence"
                  value={
                    stats.average_confidence !== null
                      ? `${(stats.average_confidence * 100).toFixed(1)}%`
                      : "-"
                  }
                />
                <StatCard label="Days Active" value={stats.trends.length} />
              </SimpleGrid>
            )}

            {stats && stats.trends.length > 0 && (
              <Card withBorder padding="md" radius="md">
                <Text size="sm" fw={600} mb="xs">
                  Predictions over time
                </Text>
                <BarChart
                  h={220}
                  data={stats.trends.map((t) => ({ date: t.date, count: t.count }))}
                  dataKey="date"
                  series={[{ name: "count", color: "indigo.6" }]}
                />
              </Card>
            )}

            <Card withBorder padding="md" radius="md">
              <Text size="sm" fw={600} mb="xs">
                Recent predictions
              </Text>
              {history && history.length === 0 && (
                <Text c="dimmed" size="sm">
                  No predictions made yet.
                </Text>
              )}
              {history && history.length > 0 && (
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Model</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Rows</Table.Th>
                      <Table.Th>Avg Confidence</Table.Th>
                      <Table.Th>Date</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {history.map((h) => (
                      <Table.Tr key={h.id}>
                        <Table.Td>{h.model_name}</Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light">
                            {h.prediction_type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{h.row_count}</Table.Td>
                        <Table.Td>
                          {h.avg_confidence !== null ? `${(h.avg_confidence * 100).toFixed(1)}%` : "-"}
                        </Table.Td>
                        <Table.Td>{new Date(h.created_at).toLocaleString()}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
