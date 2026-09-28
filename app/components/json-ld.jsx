export default function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      // `<` is escaped so a string in the data can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
