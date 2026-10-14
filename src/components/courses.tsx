import { BookOpenCheck, ChevronDown, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Field, FieldArray, Form, Formik } from "formik";
import { useMemo, useState } from "react";
import type { InternshipCourse, InternshipTopic } from "../types";
import { DropdownSelector } from "./dropdown-selector";
import { Button, Card, Input } from "./ui";

interface CoursesProps {
  topics: InternshipTopic[];
  onSave: (topics: InternshipTopic[]) => void;
}

const newTopicOption = "__new_topic__";
const blankCourse = (): InternshipCourse => ({
  id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "", duration: "", fee: 0, description: "", whatsappGroupLink: "",
});
const blankTopic = (): InternshipTopic => ({
  id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "", courses: [blankCourse()],
});

export function Courses({ topics, onSave }: CoursesProps) {
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id ?? newTopicOption);
  const topic = useMemo(() => topics.find((item) => item.id === selectedTopicId), [selectedTopicId, topics]);
  const isNewTopic = selectedTopicId === newTopicOption;
  const initialTopic = topic ?? blankTopic();
  const saveTopic = (updatedTopic: InternshipTopic) => {
    const nextTopics = isNewTopic ? [...topics, updatedTopic] : topics.map((item) => item.id === updatedTopic.id ? updatedTopic : item);
    onSave(nextTopics);
    setSelectedTopicId(updatedTopic.id);
  };

  return <div className="page-content courses-page">
    <div className="course-page-intro"><div><span className="eyebrow">PROGRAMME CATALOGUE</span><h2>Internship topics and courses</h2><p>Select an existing internship topic to maintain its courses, or create a new topic before adding its first course.</p></div><BookOpenCheck size={24} /></div>
    <Card className="topic-picker-card"><label>Internship topic / इंटर्नशिप विषय<DropdownSelector ariaLabel="Select internship topic" value={selectedTopicId} onValueChange={setSelectedTopicId} options={[...topics.map((item) => ({ value: item.id, label: item.name })), { value: newTopicOption, label: "+ Create a new internship topic" }]} /></label><small>Topics are the main areas, such as Software or Emerging Technology. Courses are added under a topic.</small></Card>
    <Formik enableReinitialize initialValues={{ topic: initialTopic }} onSubmit={({ topic: updatedTopic }) => saveTopic(updatedTopic)}>
      {({ values }) => <Form className="topic-form">
        <Card className="topic-card"><div className="topic-card-head"><div><span className="eyebrow">{isNewTopic ? "NEW INTERNSHIP TOPIC" : "EDITING INTERNSHIP TOPIC"}</span><label>Topic title<Field as={Input} name="topic.name" placeholder="e.g. Software" required /></label></div>{!isNewTopic && <span className="topic-course-count">{values.topic.courses.length} courses</span>}</div>
          <FieldArray name="topic.courses">{({ push: addCourse, remove: removeCourse }) => <div className="topic-courses"><div className="course-heading"><div><BookOpenCheck size={17} /><b>Courses under {values.topic.name || "this topic"}</b></div><Button type="button" className="button-outline small-action" onClick={() => addCourse(blankCourse())}><Plus size={15} /> Add course</Button></div>
            {values.topic.courses.map((course, courseIndex) => <details className="course-accordion" key={course.id} open={isNewTopic && courseIndex === 0}><summary><span className="course-number">{courseIndex + 1}</span><span><b>{course.name || "New course"}</b><small>{course.duration || "Set duration"} · {course.fee ? `₹${Number(course.fee).toLocaleString("en-IN")}` : "Set fee"}</small></span><ChevronDown size={18} /></summary><div className="course-accordion-content"><div className="course-fields"><label>Course name<Field as={Input} name={`topic.courses.${courseIndex}.name`} placeholder="e.g. Android App" required /></label><label>Duration<Field as={Input} name={`topic.courses.${courseIndex}.duration`} placeholder="e.g. 8 weeks" required /></label><label>Fee (INR)<Field as={Input} type="number" min="0" name={`topic.courses.${courseIndex}.fee`} required /></label><label className="full-field">Description<Field as={Input} name={`topic.courses.${courseIndex}.description`} placeholder="Brief course overview shown to students" required /></label><label className="full-field">WhatsApp group link<Field as={Input} type="url" name={`topic.courses.${courseIndex}.whatsappGroupLink`} placeholder="https://chat.whatsapp.com/..." /></label></div>{values.topic.courses.length > 1 && <button type="button" className="text-danger remove-course-link" onClick={() => removeCourse(courseIndex)}><Trash2 size={16} /> Remove course</button>}</div></details>)}
          </div>}</FieldArray>
        </Card>
        <div className="setup-actions"><span><Pencil size={16} /> {isNewTopic ? "Create the topic and its first course together." : "Updates are saved locally and will be available in student registration."}</span><Button type="submit"><Save size={16} /> {isNewTopic ? "Create topic" : "Save course changes"}</Button></div>
      </Form>}
    </Formik>
  </div>;
}
