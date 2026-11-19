import { Card } from "../ui/card";
import { Bone } from "./bone";

export { Bone };

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function PageHeaderSkeleton() {
  return (
    <div className="mb-8 space-y-2">
      <Bone className="h-8 w-56" />
      <Bone className="h-4 w-96 max-w-full" />
    </div>
  );
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading posts">
      {range(count).map((i) => (
        <div key={i} className="space-y-3 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Bone className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Bone className="h-3.5 w-32" />
              <Bone className="h-3 w-24" />
            </div>
          </div>
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-4/5" />
          <div className="flex gap-5">
            {range(4).map((j) => (
              <Bone key={j} className="h-5 w-10" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="divide-y divide-border" role="status" aria-label="Loading">
      {range(rows).map((i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-4">
          <Bone className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 w-40" />
            <Bone className="h-3 w-24" />
          </div>
          <Bone className="h-6 w-16" />
        </div>
      ))}
    </Card>
  );
}

export function StatTilesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5" role="status" aria-label="Loading stats">
      {range(count).map((i) => (
        <Card key={i} className="space-y-3 p-5">
          <Bone className="h-3 w-20" />
          <Bone className="h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-7" role="status" aria-label="Loading calendar">
      {range(7).map((i) => (
        <Card key={i} className="min-h-40 space-y-2 p-3">
          <Bone className="h-4 w-14" />
          <Bone className="h-14 w-full" />
          {i % 2 === 0 && <Bone className="h-14 w-full" />}
        </Card>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Card className="space-y-5 p-6" role="status" aria-label="Loading form">
      {range(fields).map((i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-3.5 w-24" />
          <Bone className="h-10 w-full" />
        </div>
      ))}
      <Bone className="h-10 w-28" />
    </Card>
  );
}
