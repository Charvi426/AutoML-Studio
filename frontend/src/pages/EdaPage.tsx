import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container,
  Title,
  Text,
  Card,
  SimpleGrid,
  Group,
  Select,
  Button,
  Badge,
  Table,
  Loader,
  Center,
  Alert,
  Stack,
  Tabs,
  Progress,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { notifications } from "@mantine/notifications";
import { getDatasetProfile, setTargetColumn } from "../api/datasets";
import { extractErrorMessage } from "../api/client";
import { useSelectedDataset } from "../hooks/useSelectedDataset";

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

export default function EdaPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const { datasetId, dataset, datasets, datasetsLoading, selectDataset } =
    useSelectedDataset(id);

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["profile", id, datasetId],
    queryFn: () => getDatasetProfile(id, datasetId),
    enabled: Number.isFinite(id) && Number.isFinite(datasetId),
  });

  const targetMutation = useMutation({
    mutationFn: (targetColumn: string) => setTargetColumn(id, datasetId, targetColumn),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["datasets", id] });
      notifications.show({
        title: "Target set",
        message: `Detected: ${result.problem_type.replace("_", " ")}`,
        color: "green",
      });
    },
    onError: (err) => {
      notifications.show({ title: "Failed to set target", message: extractErrorMessage(err), color: "red" });
    },
  });

  const columnOptions = useMemo(
    () => profile?.column_stats.map((c) => c.name) ?? [],
    [profile],
  );

  if (datasetsLoading || (!Number.isFinite(datasetId) && datasets && datasets.length > 0)) {
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
          Upload a CSV from the project overview page before exploring it.
        </Alert>
        <Button mt="md" onClick={() => navigate(`/projects/${id}`)}>
          Back to project
        </Button>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="xs">
        <Title order={2}>{dataset?.filename ?? "Dataset"}</Title>
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

      {isLoading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}
      {error && <Alert color="red">{extractErrorMessage(error)}</Alert>}

      {profile && (
        <Stack gap="lg">
          <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }}>
            <StatCard label="Rows" value={profile.rows} />
            <StatCard label="Columns" value={profile.columns} />
            <StatCard label="Missing" value={`${profile.missing_values_pct}%`} />
            <StatCard label="Duplicates" value={profile.duplicate_rows} />
            <StatCard label="Numeric" value={profile.numeric_columns} />
            <StatCard label="Categorical" value={profile.categorical_columns} />
          </SimpleGrid>

          <Card withBorder padding="lg" radius="md">
            <Title order={4} mb="sm">
              Target Column
            </Title>
            {dataset?.target_column ? (
              <Group mb="sm">
                <Badge color="teal" size="lg">
                  Current target: {dataset.target_column}
                </Badge>
                <Badge color="blue" size="lg" variant="light">
                  {dataset.problem_type?.replace("_", " ")}
                </Badge>
              </Group>
            ) : (
              <Text c="dimmed" size="sm" mb="sm">
                No target column selected yet. Choose which column you want to predict.
              </Text>
            )}
            <Group>
              <Select
                placeholder="Choose a column"
                data={columnOptions}
                value={selectedTarget}
                onChange={setSelectedTarget}
                searchable
                w={280}
              />
              <Button
                onClick={() => selectedTarget && targetMutation.mutate(selectedTarget)}
                loading={targetMutation.isPending}
                disabled={!selectedTarget}
              >
                Set Target
              </Button>
            </Group>

            {targetMutation.data && (
              <Stack mt="md" gap="xs">
                {targetMutation.data.class_distribution && (
                  <BarChart
                    h={220}
                    data={targetMutation.data.class_distribution.map((c) => ({
                      value: c.value,
                      count: c.count,
                    }))}
                    dataKey="value"
                    series={[{ name: "count", color: "blue.6" }]}
                  />
                )}
                {targetMutation.data.regression_summary && (
                  <SimpleGrid cols={5}>
                    <StatCard label="Mean" value={targetMutation.data.regression_summary.mean?.toFixed(2) ?? "-"} />
                    <StatCard label="Median" value={targetMutation.data.regression_summary.median?.toFixed(2) ?? "-"} />
                    <StatCard label="Min" value={targetMutation.data.regression_summary.min?.toFixed(2) ?? "-"} />
                    <StatCard label="Max" value={targetMutation.data.regression_summary.max?.toFixed(2) ?? "-"} />
                    <StatCard label="Std" value={targetMutation.data.regression_summary.std?.toFixed(2) ?? "-"} />
                  </SimpleGrid>
                )}
              </Stack>
            )}
          </Card>

          <Tabs defaultValue="columns">
            <Tabs.List>
              <Tabs.Tab value="columns">Column Stats</Tabs.Tab>
              <Tabs.Tab value="missing">Missing Values</Tabs.Tab>
              <Tabs.Tab value="histograms">Histograms</Tabs.Tab>
              <Tabs.Tab value="correlation">Correlation</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="columns" pt="md">
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Column</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Missing</Table.Th>
                    <Table.Th>Mean / Mode</Table.Th>
                    <Table.Th>Min</Table.Th>
                    <Table.Th>Max</Table.Th>
                    <Table.Th>Unique</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {profile.column_stats.map((col) => (
                    <Table.Tr key={col.name}>
                      <Table.Td>{col.name}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={col.dtype === "numeric" ? "blue" : "grape"}>
                          {col.dtype}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{col.missing_pct}%</Table.Td>
                      <Table.Td>
                        {col.dtype === "numeric" ? col.mean?.toFixed(2) : String(col.mode ?? "-")}
                      </Table.Td>
                      <Table.Td>{col.min ?? "-"}</Table.Td>
                      <Table.Td>{col.max ?? "-"}</Table.Td>
                      <Table.Td>{col.unique_count ?? "-"}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            <Tabs.Panel value="missing" pt="md">
              {profile.missing_values.every((m) => m.missing_count === 0) ? (
                <Text c="dimmed">No missing values in this dataset.</Text>
              ) : (
                <Stack gap="xs">
                  {profile.missing_values
                    .filter((m) => m.missing_count > 0)
                    .map((m) => (
                      <div key={m.column}>
                        <Group justify="space-between" mb={4}>
                          <Text size="sm">{m.column}</Text>
                          <Text size="sm" c="dimmed">
                            {m.missing_count} ({m.missing_pct}%)
                          </Text>
                        </Group>
                        <Progress value={m.missing_pct} color="orange" />
                      </div>
                    ))}
                </Stack>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="histograms" pt="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {profile.histograms.map((h) => (
                  <Card key={h.column} withBorder padding="sm">
                    <Text size="sm" fw={600} mb="xs">
                      {h.column}
                    </Text>
                    <BarChart
                      h={180}
                      data={h.counts.map((count, i) => ({
                        bin: `${h.bin_edges[i].toFixed(1)}`,
                        count,
                      }))}
                      dataKey="bin"
                      series={[{ name: "count", color: "indigo.6" }]}
                      withLegend={false}
                    />
                  </Card>
                ))}
              </SimpleGrid>
            </Tabs.Panel>

            <Tabs.Panel value="correlation" pt="md">
              {!profile.correlation_matrix ? (
                <Text c="dimmed">Not enough numeric columns for a correlation matrix.</Text>
              ) : (
                <Table withTableBorder style={{ tableLayout: "fixed" }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th></Table.Th>
                      {profile.correlation_matrix.columns.map((c) => (
                        <Table.Th key={c} style={{ fontSize: 11 }}>
                          {c}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {profile.correlation_matrix.matrix.map((row, i) => (
                      <Table.Tr key={profile.correlation_matrix!.columns[i]}>
                        <Table.Td style={{ fontSize: 11, fontWeight: 600 }}>
                          {profile.correlation_matrix!.columns[i]}
                        </Table.Td>
                        {row.map((value, j) => {
                          const v = value ?? 0;
                          const intensity = Math.min(Math.abs(v), 1);
                          const color =
                            v >= 0
                              ? `rgba(34,139,230,${intensity})`
                              : `rgba(224,49,49,${intensity})`;
                          return (
                            <Table.Td
                              key={j}
                              style={{ background: color, fontSize: 11, textAlign: "center" }}
                            >
                              {v.toFixed(2)}
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Container>
  );
}
