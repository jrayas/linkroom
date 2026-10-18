// Builds the fixture vault described in docs/09-testing.md into test-vault/template.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('test-vault', 'template');
fs.rmSync(root, { recursive: true, force: true });

function write(rel, content) {
	const p = path.join(root, rel);
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, content);
}

// Smallest valid 1x1 PNG.
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
	'1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

write('Trip Plan.md', `---
related: "[[Weekend Ideas]]"
---
# Trip Plan

We are staying at [[Hotel Booking|the hotel]]. Flights are in [[Flight Details#Return]].

![[Visa Checklist]]

The money side is in [[Annual Budget Plan for 2026#^budget]] and [[Currency Notes]] (not written yet).

Before leaving, check the [[Packing List]]. A photo: ![[photo.png]] and ![[missing.png]].

This is [[Trip Plan]] itself.
`);
write('Travel/Bookings/Hotel Booking.md', `---
aliases:
  - Booking
  - Hotel
---
Back to [[Trip Plan]].
`);
write('Travel/Bookings/Flight Details.md', '# Outbound\n\n# Return\n');
write('Travel/Admin/Visa Checklist.md', '- Passport\n');
write('Finance/Yearly/Annual Budget Plan for 2026.md', 'Total ^budget\n');
write('Travel/Packing List.md', 'For [[Trip Plan]].\n');
write('Weekend Ideas.md', 'Maybe after the [[Trip Plan]].\n');
write('Journal/2026/Travel Journal.md', 'Planning the [[Trip Plan|trip]] today.\n');

write('Edge Cases.md', `---
see: "[[Day 10]]"
---
Duplicates: [[Work/Meeting]] and [[Home/Meeting]].
Unicode: [[Café Ödön]], [[東京]]. Numbers: [[Day 2]], [[Day 10]].
Long: [[Averyveryverylongnamewithoutanyspacesatalljusttotestwrappingandtruncationbehaviour1234567890]].
Long with spaces: [[A rather long note name that will certainly not fit inside one narrow grid column]].
Deep: [[Clients/Client A/Projects/2026/Notes/Kickoff]].
Not notes: [[Board.canvas]], [[Guide.pdf]], ![[photo.png]].
Markdown link: [Hotel](Travel/Bookings/Hotel%20Booking.md).
`);
write('Work/Meeting.md', 'Work meeting.\n');
write('Home/Meeting.md', 'Home meeting, see [[Edge Cases]].\n');
write('Café Ödön.md', 'Accents.\n');
write('東京.md', 'Tokyo.\n');
write('Day 2.md', '');
write('Day 10.md', '');
write('Averyveryverylongnamewithoutanyspacesatalljusttotestwrappingandtruncationbehaviour1234567890.md', '');
write('A rather long note name that will certainly not fit inside one narrow grid column.md', '');
write('Clients/Client A/Projects/2026/Notes/Kickoff.md', 'Back to [[Edge Cases]].\n');
write('Board.canvas', '{"nodes":[],"edges":[]}\n');
write('Guide.pdf', '%PDF-1.1\n%%EOF\n');
fs.writeFileSync(path.join(root, 'photo.png'), PNG);

// Big Hub: 500 outgoing links, 50 of which link back.
const lines = ['# Big Hub', ''];
for (let i = 1; i <= 500; i++) {
	const n = String(i).padStart(3, '0');
	lines.push(`- [[Hub Note ${n}]]`);
	write(`Hub/Hub Note ${n}.md`, i <= 50 ? 'Part of the [[Big Hub]].\n' : `Note ${n}.\n`);
}
write('Big Hub.md', lines.join('\n') + '\n');

write('.obsidian/community-plugins.json', JSON.stringify(['linkroom']));
write('.obsidian/app.json', JSON.stringify({ alwaysUpdateLinks: true }));
fs.mkdirSync(path.join(root, '.obsidian', 'plugins', 'linkroom'), { recursive: true });
console.log(`Fixture vault written to ${root}`);
