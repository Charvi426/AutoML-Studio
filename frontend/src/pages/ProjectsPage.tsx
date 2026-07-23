import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container,
  Title,
  Button,
  Card,
  SimpleGrid,
  Text,
  Group,
  Modal,
  TextInput,
  Stack,
  Loader,
  Center,
  Alert,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { listProjects, createProject } from "../api/projects";
import { extractErrorMessage } from "../api/client";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const form = useForm({
    initialValues: { project_name: "" },
    validate: {
      project_name: (v) => (v.trim().length > 0 ? null : "Project name is required"),
    },
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createProject(name),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setModalOpen(false);
      form.reset();
      navigate(`/projects/${project.id}`);
    },
  });

  return (
    <Container size="lg" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Your Projects</Title>
        <Button onClick={() => setModalOpen(true)}>New Project</Button>
      </Group>

      {isLoading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}

      {error && <Alert color="red">{extractErrorMessage(error)}</Alert>}

      {projects && projects.length === 0 && (
        <Text c="dimmed">No projects yet. Create your first one to get started.</Text>
      )}

      {projects && projects.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {projects.map((project) => (
            <Card
              key={project.id}
              withBorder
              shadow="sm"
              padding="lg"
              radius="md"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <Text fw={600}>{project.project_name}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Created {new Date(project.created_at).toLocaleDateString()}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="New Project">
        <form
          onSubmit={form.onSubmit((values) => createMutation.mutate(values.project_name))}
        >
          <Stack gap="sm">
            {createMutation.isError && (
              <Alert color="red">{extractErrorMessage(createMutation.error)}</Alert>
            )}
            <TextInput
              label="Project name"
              placeholder="Loan Prediction"
              data-autofocus
              {...form.getInputProps("project_name")}
            />
            <Button type="submit" loading={createMutation.isPending} fullWidth mt="sm">
              Create
            </Button>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
