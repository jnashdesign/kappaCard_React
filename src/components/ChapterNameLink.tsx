import { kappaChaptersSearchUrl } from '../lib/kappaChapters';

type Props = {
  chapter: string;
  className?: string;
};

/** Chapter name → kappachapters.com search (new tab). */
export default function ChapterNameLink({ chapter, className }: Props) {
  const href = kappaChaptersSearchUrl(chapter);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={`Search “${chapter.trim()}” on Kappa Chapters`}
    >
      {chapter.trim()}
    </a>
  );
}
