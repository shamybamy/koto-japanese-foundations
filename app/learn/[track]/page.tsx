import { notFound } from "next/navigation";
import { trackBySlug } from "@/lib/curriculum";
import { TrackView } from "@/components/track-view";

export async function generateStaticParams() { return Object.keys(trackBySlug).map((track) => ({ track })); }

export default async function TrackPage({ params }: { params: Promise<{ track: string }> }) {
  const { track: slug } = await params;
  const track = trackBySlug[slug];
  if (!track) notFound();
  return <TrackView track={track} />;
}
