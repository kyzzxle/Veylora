import type { QuizQuestion } from '../quiz-types';

export const rotationQuiz: QuizQuestion[] = [
  {
    question: 'A 10 N force pushes at right angles to the radius, 0.4 m from the axis. What is the torque?',
    options: ['25 N·m', '4 N·m', '10.4 N·m', '0.04 N·m'],
    answer: 1,
    explanation: 'τ = r F sin φ = 0.4 × 10 × sin 90° = 4 N·m.',
    difficulty: 'Basic',
  },
  {
    question: 'The same 10 N force now acts at 0.5 m from the axis but at 30° to the radius. What is the torque?',
    options: ['5.0 N·m', '4.3 N·m', '2.5 N·m', '0 N·m'],
    answer: 2,
    explanation: 'τ = 0.5 × 10 × sin 30° = 0.5 × 10 × 0.5 = 2.5 N·m. Only the part of the force perpendicular to the radius turns the wheel; equivalently, the lever arm is r sin φ = 0.25 m.',
    difficulty: 'Intermediate',
  },
  {
    question: 'In the simulator, you set φ = 0°, so the force points straight along the radius, away from the axis. What happens?',
    options: [
      'The wheel spins fastest',
      'Nothing: the line of action passes through the axis, so the lever arm and the torque are zero',
      'The wheel spins backwards',
      'The wheel moves sideways',
    ],
    answer: 1,
    explanation: 'Pushing a door towards its hinges does not open it, however hard you push.',
    difficulty: 'Basic',
  },
  {
    question: 'Why are door handles placed far from the hinges?',
    options: [
      'For decoration',
      'A larger distance from the axis gives more torque for the same force, so the door is easier to open',
      'It makes the door lighter',
      'It increases the door’s moment of inertia',
    ],
    answer: 1,
    explanation: 'Torque grows in proportion to r. In the near-vs-far panel, the rim wheel (r = 0.5 m) gets five times the torque of the near wheel (r = 0.1 m).',
    difficulty: 'Basic',
  },
  {
    question: 'A solid disk and a ring have the same mass and radius. The same torque acts on each. Which speeds up faster?',
    options: [
      'The ring, because its mass is at the rim',
      'The disk, because its mass is closer to the axis, so its moment of inertia is smaller (½MR² vs MR²)',
      'They speed up equally',
      'Neither turns',
    ],
    answer: 1,
    explanation: 'α = τ/I. The ring’s moment of inertia is twice the disk’s, so its angular acceleration is half as large.',
    difficulty: 'Intermediate',
  },
  {
    question: 'A 10 kg solid disk of radius 0.5 m has I = ½MR². A torque of 4 N·m acts on it. What is its angular acceleration?',
    options: ['0.8 rad/s²', '3.2 rad/s²', '8 rad/s²', '40 rad/s²'],
    answer: 1,
    explanation: 'I = ½ × 10 × 0.5² = 1.25 kg·m², so α = τ/I = 4 ÷ 1.25 = 3.2 rad/s².',
    difficulty: 'Intermediate',
  },
  {
    question: 'Which pair of linear and rotational quantities is correctly matched?',
    options: ['Force ↔ angular velocity', 'Mass ↔ moment of inertia', 'Velocity ↔ torque', 'Momentum ↔ angle'],
    answer: 1,
    explanation: 'Mass measures resistance to a change in linear motion; moment of inertia measures resistance to a change in rotation. Force ↔ torque, velocity ↔ angular velocity, momentum ↔ angular momentum.',
    difficulty: 'Basic',
  },
  {
    question: 'A skater spins at 2 rad/s with a moment of inertia of 4 kg·m², then pulls in their arms so that I falls to 1 kg·m². What is their new angular velocity?',
    options: ['0.5 rad/s', '2 rad/s', '8 rad/s', '16 rad/s'],
    answer: 2,
    explanation: 'With no outside torque, L = Iω is conserved: 4 × 2 = 1 × ω, so ω = 8 rad/s.',
    difficulty: 'Intermediate',
  },
  {
    question: 'For the same skater, what happens to the rotational kinetic energy when they pull their arms in?',
    options: [
      'It stays the same, like angular momentum',
      'It increases (from 8 J to 32 J), because their muscles do work pulling the arms in',
      'It decreases',
      'It becomes zero',
    ],
    answer: 1,
    explanation: 'KE = ½Iω²: before, ½ × 4 × 2² = 8 J; after, ½ × 1 × 8² = 32 J. Angular momentum is conserved, but kinetic energy is not.',
    difficulty: 'Advanced',
  },
  {
    question: 'A wheel is spinning on a frictionless axle and the force is switched off. What happens next?',
    options: [
      'It slows down and stops',
      'It keeps turning at the same angular velocity, because there is no torque',
      'It speeds up',
      'It reverses direction',
    ],
    answer: 1,
    explanation: 'This is Newton’s first law for rotation. Real wheels slow down only because friction at the axle and air resistance provide a torque.',
    difficulty: 'Basic',
  },
];
