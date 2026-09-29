"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { actions, useStore } from "@/lib/store";
import { blankSubject, cleanSubject, validateSubject } from "@/lib/subjects";
import { notify } from "@/lib/toast";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Container, Empty, Loading, PageHeader } from "@/components/ui/Page";
import SubjectCard from "@/components/subjects/SubjectCard";
import SubjectEditor from "@/components/subjects/SubjectEditor";

export default function SubjectsPage() {
  const state = useStore();
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [removing, setRemoving] = useState(null);
  const today = state?.plan?.generatedFor;
  if (!state || !today) return <Loading />;

  const isNew = editing && !state.subjects.some((s) => s.id === editing.id);
  const open = (subject) => { setErrors({}); setEditing(subject); };
  const save = () => {
    const e = validateSubject(editing, today, state.subjects);
    setErrors(e);
    if (Object.keys(e).length) return;
    actions.saveSubject(cleanSubject(editing));
    notify(`${editing.name.trim()} saved. Your plan has been updated.`);
    setEditing(null);
  };

  const sorted = [...state.subjects].sort((a, b) => a.examDate.localeCompare(b.examDate));
  return (
    <Container>
      <PageHeader eyebrow={`${state.subjects.length} subjects`} title="Subjects">
        <Button variant="sun" onClick={() => open(blankSubject(today, state.subjects.length))}><Plus size={16} /> Add subject</Button>
      </PageHeader>
      {!sorted.length && <Empty title="No subjects yet">Add a subject with its exam date and topics, and your plan appears.</Empty>}
      <div className="grid gap-6 md:grid-cols-2">
        {sorted.map((s, i) => (
          <SubjectCard key={s.id} subject={s} today={today} index={i} onEdit={() => open(structuredClone(s))} onDelete={() => setRemoving(s)} />
        ))}
      </div>

      <Modal open={!!editing} wide title={isNew ? "Add a subject" : "Edit subject"} onClose={() => setEditing(null)}>
        {editing && <SubjectEditor value={editing} onChange={setEditing} errors={errors} />}
        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="cobalt" onClick={save}>Save & update plan</Button>
        </div>
      </Modal>

      <Modal open={!!removing} title={`Delete ${removing?.name}?`} onClose={() => setRemoving(null)}>
        <p className="text-ink-soft">Its topics and planned sessions will be removed and your plan rebuilt.</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button onClick={() => setRemoving(null)}>Keep it</Button>
          <Button variant="bubble" onClick={() => { actions.deleteSubject(removing.id); notify(`${removing.name} deleted.`); setRemoving(null); }}>Delete</Button>
        </div>
      </Modal>
    </Container>
  );
}
