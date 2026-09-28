export default function PageTitle({ title, lead }) {
  return (
    <div className="mb-10">
      <h1 className="text-[1.6rem] font-bold tracking-wider">{title}</h1>
      {lead && <p className="mt-2 text-muted">{lead}</p>}
    </div>
  );
}
