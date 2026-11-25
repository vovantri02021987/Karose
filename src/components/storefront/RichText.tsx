/**
 * Hiển thị văn bản nhiều khối của sản phẩm (mô tả, hướng dẫn, bảo quản).
 * Quy ước dữ liệu: các khối cách nhau bằng dòng trống; dòng bắt đầu bằng "- " là
 * gạch đầu dòng; một dòng tiêu đề (không có "- ") đứng ngay trước các gạch đầu
 * dòng sẽ thành tiêu đề nhỏ của khối đó.
 */
export default function RichText({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length > 0);

  return (
    <div className="space-y-5 leading-relaxed">
      {blocks.map((lines, i) => {
        const isBullet = (l: string) => l.startsWith("- ");
        const hasTitle = !isBullet(lines[0]) && lines.length > 1 && lines.slice(1).every(isBullet);
        const items = (hasTitle ? lines.slice(1) : lines).filter(isBullet);
        if (items.length > 0 && (hasTitle || lines.every(isBullet))) {
          return (
            <div key={i}>
              {hasTitle && (
                <h3 className="mb-2 font-semibold text-foreground">{lines[0]}</h3>
              )}
              <ul className="space-y-1.5">
                {items.map((l, j) => (
                  <li key={j} className="flex gap-2">
                    <span
                      aria-hidden
                      className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                    />
                    <span>{l.slice(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {lines.join("\n")}
          </p>
        );
      })}
    </div>
  );
}
