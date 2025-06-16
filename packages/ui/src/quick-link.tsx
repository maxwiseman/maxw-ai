"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function QuickLink(props: React.ComponentProps<typeof Link>) {
  const router = useRouter();

  return (
    <Link
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        router.push(props.href.toString());
      }}
      {...props}
    >
      {props.children}
    </Link>
  );
}
