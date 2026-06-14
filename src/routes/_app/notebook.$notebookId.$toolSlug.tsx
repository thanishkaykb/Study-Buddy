import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/notebook/$notebookId/$toolSlug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/notebook/$notebookId",
      params: { notebookId: params.notebookId },
      replace: true,
    });
  },
});
