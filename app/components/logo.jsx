import Link from "next/link";

export default function Logo() {
  return (
    <div>
      <Link href="/" className="text-lg font-bold dark:text-white">
        Ryoga.io
      </Link>
    </div>
  );
}
