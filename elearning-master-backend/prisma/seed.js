const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.course.count();
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} courses already exist.`);
    return;
  }

  const instructor = await prisma.user.findFirst({ where: { role: 'instructor' } });
  const student = await prisma.user.findFirst({ where: { role: 'student' } });
  if (!instructor) throw new Error('No instructor user found. Run provisionAdmin/demo-user scripts first.');

  const courses = [
    {
      title: 'Full-Stack Web Development Bootcamp',
      description: 'Build modern web applications with React, Node.js, Express and databases. Hands-on projects and career guidance included.',
      category: 'Web Development',
      price: 499,
      isPublished: true,
      joinCode: 'FSWD26',
      modules: [
        { title: 'Frontend Foundations', lessons: [
          { title: 'HTML & CSS Essentials', content: 'Semantic HTML, modern CSS layout with Flexbox and Grid, responsive design principles.' },
          { title: 'JavaScript Fundamentals', content: 'Variables, functions, DOM manipulation, events, async/await and ES6+ features.' },
          { title: 'React Basics', content: 'Components, props, state, hooks and building reusable UI.', videoUrl: 'https://example.com/videos/react-basics' },
        ]},
        { title: 'Backend & APIs', lessons: [
          { title: 'Node.js & Express', content: 'REST API design, middleware, routing and error handling in Express.' },
          { title: 'Databases with Prisma', content: 'Schema design, relations, migrations and querying with Prisma ORM.' },
        ]},
      ],
      assignments: [{ title: 'Build a Portfolio Page', instructions: 'Create a responsive portfolio using HTML, CSS and vanilla JS. Submit the GitHub link.' }],
      announcements: [{ title: 'Welcome to the Bootcamp!', body: 'Introduce yourself in the class stream. Week 1 starts Monday.' }],
      materials: [{ kind: 'note', title: 'Course Roadmap', description: 'Week-by-week breakdown of topics and milestones.' }],
    },
    {
      title: 'Python for Data Analysis',
      description: 'Learn Python, pandas and data visualization to turn raw data into insights. Real datasets and case studies.',
      category: 'Data Science',
      price: 399,
      isPublished: true,
      joinCode: 'PYDA26',
      modules: [
        { title: 'Python Crash Course', lessons: [
          { title: 'Python Syntax & Data Types', content: 'Variables, lists, dicts, loops, functions and file handling.' },
          { title: 'Working with pandas', content: 'DataFrames, filtering, groupby, merging and cleaning datasets.' },
        ]},
        { title: 'Visualization', lessons: [
          { title: 'Charts with Matplotlib', content: 'Line, bar, scatter and heatmap charts for exploratory analysis.' },
        ]},
      ],
      assignments: [{ title: 'EDA on a Real Dataset', instructions: 'Perform exploratory data analysis on the provided sales dataset and share your notebook.' }],
      announcements: [{ title: 'Dataset Released', body: 'Download this week\'s dataset from the materials section.' }],
      materials: [{ kind: 'file', title: 'Week 1 Dataset (CSV)', description: 'Retail sales sample data for practice.' }],
    },
    {
      title: 'UI/UX Design Fundamentals',
      description: 'Design beautiful, usable interfaces. Color theory, typography, wireframing and prototyping with modern tools.',
      category: 'Design',
      price: 299,
      isPublished: true,
      joinCode: 'UIUX26',
      modules: [
        { title: 'Design Thinking', lessons: [
          { title: 'User Research Basics', content: 'Interviews, personas, journey maps and defining the problem.' },
          { title: 'Wireframing & Prototyping', content: 'Low-fi to hi-fi flows, design systems and handoff.' },
        ]},
      ],
      assignments: [{ title: 'Redesign a Signup Flow', instructions: 'Pick an app, critique its signup flow and deliver a redesigned prototype.' }],
      announcements: [],
      materials: [{ kind: 'note', title: 'Design Checklist', description: 'Accessibility and usability checklist for every project.' }],
    },
  ];

  for (const c of courses) {
    const course = await prisma.course.create({
      data: {
        title: c.title, description: c.description, category: c.category,
        instructorId: instructor.id, price: c.price, isPublished: c.isPublished, joinCode: c.joinCode,
        modules: {
          create: c.modules.map((m, mi) => ({
            title: m.title, sortOrder: mi,
            lessons: { create: m.lessons.map((l, li) => ({ title: l.title, content: l.content, videoUrl: l.videoUrl || null, sortOrder: li })) },
          })),
        },
        assignments: { create: c.assignments.map(a => ({ title: a.title, instructions: a.instructions })) },
        announcements: { create: c.announcements },
        materials: { create: c.materials },
      },
      include: { modules: true },
    });

    if (student) {
      await prisma.courseEnrollment.create({ data: { courseId: course.id, studentId: student.id } });
    }
    console.log(`Seeded course: ${course.title} (id ${course.id})`);
  }

  await prisma.project.createMany({ data: [
    { title: 'E-commerce Platform', description: 'Full-stack storefront with payments, admin dashboard and inventory management.', category: 'Web App', isFeatured: true, isPublished: true, sortOrder: 1, tags: ['React', 'Node.js', 'Stripe'] },
    { title: 'Hospital Management System', description: 'Appointment booking, patient records and billing for clinics.', category: 'Web App', isPublished: true, sortOrder: 2, tags: ['React', 'Express', 'MySQL'] },
    { title: 'TaskFlow Mobile App', description: 'Cross-platform productivity app with offline sync and team collaboration.', category: 'Mobile', isPublished: true, sortOrder: 3, tags: ['React Native', 'Firebase'] },
    { title: 'SEO Analytics Dashboard', description: 'Real-time SEO metrics, keyword tracking and competitor analysis.', category: 'SaaS', isPublished: true, sortOrder: 4, tags: ['Next.js', 'D3.js'] },
  ]});

  await prisma.faq.createMany({ data: [
    { question: 'How do I enroll in a course?', answer: 'Open the course page and click Enroll, or join with the class code shared by your instructor.', displayOrder: 1, isPublished: true },
    { question: 'Are the courses self-paced?', answer: 'Yes. All courses are self-paced with lifetime access once enrolled.', displayOrder: 2, isPublished: true },
    { question: 'Do I get a certificate?', answer: 'Certificates are issued automatically after you complete all lessons and assignments.', displayOrder: 3, isPublished: true },
    { question: 'What payment methods do you accept?', answer: 'We accept all major cards and popular digital payment methods.', displayOrder: 4, isPublished: true },
    { question: 'Can I get a refund?', answer: 'Yes, within 7 days of purchase if you are not satisfied.', displayOrder: 5, isPublished: true },
  ]});

  await prisma.teamMember.createMany({ data: [
    { name: 'Aarav Sharma', title: 'CEO & Founder', bio: '15+ years building products for startups and enterprises.', displayOrder: 1, isPublished: true },
    { name: 'Priya Nair', title: 'Lead UI/UX Designer', bio: 'Crafts clean, human-centered interfaces.', displayOrder: 2, isPublished: true },
    { name: 'Rohan Mehta', title: 'Senior Full-Stack Engineer', bio: 'Specialist in scalable web platforms.', displayOrder: 3, isPublished: true },
    { name: 'Sneha Kulkarni', title: 'Data Science Lead', bio: 'Turns data into decisions.', displayOrder: 4, isPublished: true },
  ]});

  await prisma.statsMetric.createMany({ data: [
    { label: 'Students Trained', manualValue: '1200+', displayOrder: 1, isPublished: true },
    { label: 'Projects Delivered', manualValue: '350+', displayOrder: 2, isPublished: true },
    { label: 'Expert Instructors', manualValue: '25+', displayOrder: 3, isPublished: true },
    { label: 'Client Satisfaction', manualValue: '98%', displayOrder: 4, isPublished: true },
  ]});

  console.log('Seed complete.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
