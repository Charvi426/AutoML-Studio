import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Title,
  Text,
  Group,
  Select,
  NumberInput,
  Stack,
  Loader,
  Center,
  Alert,
  SimpleGrid,
} from "@mantine/core";
import { BarChart } from "@mantine/charts";
import { getShapSummary, getShapInstance } from "../api/explainability";
import { extractErrorMessage } from "../api/client";
import type { TrainingRunOut } from "../types/api";

const TOP_FEATURES_SHOWN = 10;

interface ModelExplainabilityProps {
  projectId: number;
  datasetId: number;
  run: TrainingRunOut;
}

export default function ModelExplainability({
  projectId,
  datasetId,
  run,
}: ModelExplainabilityProps) {
  const [modelName, setModelName] = useState<string | null>(
    run.best_model_name ?? run.model_results[0]?.model_name ?? null,
  );
  const [rowIndex, setRowIndex] = useState<number>(0);

  // If the selected model isn't part of this run (e.g. after switching to a
  // different run via the history table), fall back to its best model.
  useEffect(() => {
    const names = run.model_results.map((m) => m.model_name);
    if (!modelName || !names.includes(modelName)) {
      setModelName(run.best_model_name ?? names[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ["shap-summary", projectId, datasetId, run.id, modelName],
    queryFn: () => getShapSummary(projectId, datasetId, run.id, modelName!),
    enabled: !!modelName,
  });

  const {
    data: instance,
    isLoading: instanceLoading,
    error: instanceError,
  } = useQuery({
    queryKey: ["shap-instance", projectId, datasetId, run.id, modelName, rowIndex],
    queryFn: () => getShapInstance(projectId, datasetId, run.id, modelName!, rowIndex),
    enabled: !!modelName && rowIndex >= 0,
  });

  const topFeatures = summary?.feature_importance.slice(0, TOP_FEATURES_SHOWN) ?? [];
  const maxAbsContribution = instance
    ? Math.max(...instance.contributions.map((c) => Math.abs(c.shap_value)), 0.0001)
    : 1;

  return (
    <Card withBorder padding="lg" radius="md">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Explain Predictions</Title>
        <Select
          data={run.model_results.map((m) => m.model_name)}
          value={modelName}
          onChange={setModelName}
          w={200}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <div>
          <Text size="sm" fw={600} mb="xs">
            Which features matter most overall
          </Text>
          {summaryLoading && (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          )}
          {summaryError && <Alert color="red">{extractErrorMessage(summaryError)}</Alert>}
          {topFeatures.length > 0 && (
            <BarChart
              h={280}
              data={topFeatures.map((f) => ({ feature: f.feature, importance: f.mean_abs_shap }))}
              dataKey="feature"
              series={[{ name: "importance", color: "indigo.6" }]}
              withLegend={false}
            />
          )}
        </div>

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600}>
              Why one specific prediction was made
            </Text>
            <NumberInput
              value={rowIndex}
              onChange={(value) => setRowIndex(typeof value === "number" ? value : 0)}
              min={0}
              w={100}
              size="xs"
              label="Row #"
            />
          </Group>

          {instanceLoading && (
            <Center py="md">
              <Loader size="sm" />
            </Center>
          )}
          {instanceError && <Alert color="red">{extractErrorMessage(instanceError)}</Alert>}

          {instance && (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Base value: {instance.base_value.toFixed(3)}
                </Text>
                <Text size="xs" fw={700}>
                  {instance.explained_class ? `P(${instance.explained_class})` : "Predicted"}:{" "}
                  {instance.predicted_value.toFixed(3)}
                  {instance.predicted_class && instance.predicted_class !== instance.explained_class
                    ? ` (model predicted: ${instance.predicted_class})`
                    : ""}
                </Text>
              </Group>

              {instance.contributions.slice(0, TOP_FEATURES_SHOWN).map((c) => {
                const isPositive = c.shap_value >= 0;
                const widthPct = (Math.abs(c.shap_value) / maxAbsContribution) * 100;
                return (
                  <div key={c.feature}>
                    <Group justify="space-between" mb={2}>
                      <Text size="xs">
                        {c.feature} = {c.value}
                      </Text>
                      <Text size="xs" c={isPositive ? "teal" : "red"} fw={600}>
                        {isPositive ? "+" : ""}
                        {c.shap_value.toFixed(3)}
                      </Text>
                    </Group>
                    <div
                      style={{
                        height: 8,
                        background: "var(--mantine-color-gray-1)",
                        borderRadius: 4,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${widthPct}%`,
                          background: isPositive
                            ? "var(--mantine-color-teal-6)"
                            : "var(--mantine-color-red-6)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </Stack>
          )}
        </div>
      </SimpleGrid>
    </Card>
  );
}
