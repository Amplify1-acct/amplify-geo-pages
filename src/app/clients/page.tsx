import type { Metadata } from "next";
import ClientConnections from "./client-connections";

export const metadata: Metadata = {
  title: "Client Connections | AMPLIFY Content",
  description: "Connect AMPLIFY law-firm clients to the content workflow.",
};

export default function ClientConnectionsPage() {
  return <ClientConnections />;
}
