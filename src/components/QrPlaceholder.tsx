import { useMemo } from 'react';

/** Decorative QR placeholder for UI preview (not a scannable code). */
const QrPlaceholder = ({ label, sizeClass = 'w-32 h-32' }: { label?: string; sizeClass?: string }) => {
  const cells = useMemo(() => {
    const size = 21;
    const grid: boolean[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const inFinder =
          (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
        const onFinderBorder =
          inFinder &&
          (x === 0 ||
            x === 6 ||
            x === size - 7 ||
            x === size - 1 ||
            y === 0 ||
            y === 6 ||
            y === size - 7 ||
            y === size - 1 ||
            (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
            (x >= size - 5 && x <= size - 3 && y >= 2 && y <= 4) ||
            (x >= 2 && x <= 4 && y >= size - 5 && y <= size - 3));
        const data = (x * 7 + y * 13) % 5 < 2;
        grid.push(inFinder ? onFinderBorder : data);
      }
    }
    return { size, grid };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-2 border border-gray-200 rounded-lg">
        <svg viewBox={`0 0 ${cells.size} ${cells.size}`} className={`${sizeClass} text-gray-900`} aria-hidden="true">
          {cells.grid.map((on, i) =>
            on ? (
              <rect
                key={i}
                x={i % cells.size}
                y={Math.floor(i / cells.size)}
                width="1"
                height="1"
                fill="currentColor"
              />
            ) : null,
          )}
        </svg>
      </div>
      {label ? <p className="text-xs text-gray-500 text-center">{label}</p> : null}
    </div>
  );
};

export default QrPlaceholder;
