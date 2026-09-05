import { notFound } from "next/navigation";
import { getLesson, trackBySlug } from "@/lib/curriculum";
import { LessonView } from "@/components/lesson-view";

export async function generateStaticParams() { return Object.values(trackBySlug).flatMap((track) => track.lessons.map((lesson) => ({ track: track.slug, lesson: lesson.slug }))); }

export default async function LessonPage({ params }: { params: Promise<{ track: string; lesson: string }> }) {
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = trackBySlug[trackSlug];
  const lesson = getLesson(trackSlug, lessonSlug);
  if (!track || !lesson) notFound();
  return <LessonView track={track} lesson={lesson} />;
}
