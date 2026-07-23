import { useNavigate } from "react-router-dom";
import { Container, Title, Text, Button, Group, SimpleGrid, Card, Stack, Box } from "@mantine/core";
import { useAuth } from "../context/AuthContext";

const STEPS = [
  { title: "Upload", description: "Upload any tabular CSV dataset." },
  { title: "Explore", description: "Automatic profiling, stats, and correlations." },
  { title: "Train", description: "Train and compare 5 ML models automatically." },
  { title: "Explain", description: "Understand predictions with SHAP." },
  { title: "Predict", description: "Save the best model and predict on new data." },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Box>
      <Container size="md" py={80}>
        <Stack align="center" gap="md" ta="center">
          <Title order={1} size={48}>
            AutoML Studio
          </Title>
          <Text size="lg" c="dimmed" maw={520}>
            Upload a tabular dataset and get a trained, explainable machine learning model in
            minutes — no code required.
          </Text>
          <Group mt="md">
            {user ? (
              <Button size="md" onClick={() => navigate("/projects")}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button size="md" onClick={() => navigate("/register")}>
                  Get Started
                </Button>
                <Button size="md" variant="default" onClick={() => navigate("/login")}>
                  Sign In
                </Button>
              </>
            )}
          </Group>
        </Stack>
      </Container>

      <Container size="lg" pb={80}>
        <SimpleGrid cols={{ base: 1, sm: 5 }} spacing="md">
          {STEPS.map((step, i) => (
            <Card key={step.title} withBorder padding="lg" radius="md">
              <Text size="xs" c="dimmed" fw={700}>
                {String(i + 1).padStart(2, "0")}
              </Text>
              <Text fw={600} mt={4}>
                {step.title}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {step.description}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}
