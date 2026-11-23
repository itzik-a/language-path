/* "Write me a story" (filled in with the Claude milestone). */
import type { Lang } from "../types";
import { Sheet } from "./ui";

export function StorySheet({ onClose }: { lang: Lang; onClose: () => void }) {
  return (
    <Sheet title="Write me a story" onClose={onClose}>
      <p className="muted">Stories at your level are written by Claude. Add your Claude key in Settings to turn this on.</p>
    </Sheet>
  );
}
