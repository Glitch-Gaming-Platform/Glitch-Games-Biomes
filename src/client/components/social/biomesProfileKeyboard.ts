export function nextBiomesProfileFocusIndexForKeyV1({
  key,
  currentIndex,
  itemCount,
}: {
  key: string;
  currentIndex: number;
  itemCount: number;
}) {
  if (itemCount <= 0) {
    return -1;
  }
  const index = Math.max(0, Math.min(itemCount - 1, currentIndex));
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
      return (index + 1) % itemCount;
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp":
      return (index - 1 + itemCount) % itemCount;
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
    default:
      return index;
  }
}
