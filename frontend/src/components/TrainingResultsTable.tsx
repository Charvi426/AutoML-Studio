import { Table, Group, Badge, Button, Card, Title } from "@mantine/core";
import type { ModelResultOut, TrainingRunOut } from "../types/api";

const CLASSIFICATION_METRICS: { key: keyof ModelResultOut; label: string }[] = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1", label: "F1" },
  { key: "roc_auc", label: "ROC AUC" },
];

const REGRESSION_METRICS: { key: keyof ModelResultOut; label: string }[] = [
  { key: "mae", label: "MAE" },
  { key: "rmse", label: "RMSE" },
  { key: "r2", label: "R2" },
];

function formatMetric(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return value.toFixed(4);
}

interface TrainingResultsTableProps {
  run: TrainingRunOut;
  title?: string;
  onSave?: (modelName: string) => void;
  savingModelName?: string;
}

export default function TrainingResultsTable({
  run,
  title = "Results",
  onSave,
  savingModelName,
}: TrainingResultsTableProps) {
  const metrics = run.problem_type.includes("classification")
    ? CLASSIFICATION_METRICS
    : REGRESSION_METRICS;

  return (
    <Card withBorder padding="lg" radius="md">
      <Title order={4} mb="sm">
        {title}
      </Title>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Model</Table.Th>
            {metrics.map((m) => (
              <Table.Th key={String(m.key)}>{m.label}</Table.Th>
            ))}
            <Table.Th>Time (s)</Table.Th>
            {onSave && <Table.Th></Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {run.model_results.map((mr) => {
            const isBest = mr.model_name === run.best_model_name;
            return (
              <Table.Tr
                key={mr.id}
                style={isBest ? { background: "var(--mantine-color-teal-0)" } : undefined}
              >
                <Table.Td>
                  <Group gap={6}>
                    {mr.model_name}
                    {isBest && (
                      <Badge color="teal" size="sm">
                        Best
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                {metrics.map((m) => (
                  <Table.Td key={String(m.key)}>{formatMetric(mr[m.key] as number | null)}</Table.Td>
                ))}
                <Table.Td>{mr.training_time_seconds.toFixed(2)}</Table.Td>
                {onSave && (
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      loading={savingModelName === mr.model_name}
                      onClick={() => onSave(mr.model_name)}
                    >
                      Save
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
