import { describe, expect, it } from "vitest";
import { extractPaperMeta } from "./extract";

const now = new Date("2026-09-29");
const courses = [
  { code: "15B11MA111", title: "Mathematics-1" },
  { code: "15B11PH111", title: "Physics-1" },
];

// Trimmed from the embedded OCR layer of real scanned papers (noise kept on purpose).
const maths = `POSSESSION OF MOBILES IN EXAM IS UFM PRACTICE
Jaypce Instituteof Information Technology, Noida
Test-2 Examination, Odd 2023
B.Tech. ISemester
Maximum Time: 1Hr
Course Title: Mathematics 1
Maximum Marks: 20
Course Code: 15B11MA111
Q1. Evaluate the following integral using Beta/Gamma functions
Q2. Draw the region of integration
Q3. Using thetransformation u= 3x + 2y
04. Find the second order Taylor's series approximation
Q5. Find the absolute maxima and minima
06. Find thevolume of the solid which is bounded by the surface`;

const physics = `Jaypce Institute ofInformatioSnemester 2023 Technolgy, Noida
T2 Exanination, Odd- Semcster 1
B. Tech. 1 Year
Course Titlc: Physics-1
Maximum Marks: 20
Course Code: 15B11PH111
Q1. (CO1(Remembering ) (5 x 1Mark =5Marks)]
Q2. |CO2(Understanding )(3 x2Marks6 Marks)]
Q3. (CO3(Applying) (2 x3Marks =6 Marks)]
Q4. (CO4(Analyzing )(3 Marlks)]`;

// Tesseract output for image-only scans (2016 and 2018 PRP end-terms), question text trimmed.
const prp2016 = `POSSESSION OF MOBILES IN EXAM IS UFM PRACTICE
Jaypee Institute of Information Technology, Noida
End Term Examination, ODD Semester-2016
B.Tech. 3rd Semester
Course Title: Probability and Random Processes/
Probability Theory and Random Processes Max Marks: 35
Course Code: 15B11MA301/10B11MA411 Max Time: 2 Hours
QI. One way to design a spam filter is to look at the words in an email. [©]
Q2. The joint probability density function of two dimensional random variables
Q3. Find the characteristic function of geometric distribution
Q4. Eight identical components with constant failure rates 4)
QS (a) Prove that the inter-arrival time of a Poisson process 3)
Q6 The three-state Markov chain is given by the transition probability matrix
Q7. An engineer analyzing a series of digital signals
Q8. Let {x } be a stationary random process with spectral density function
Q9. Prove that a random process defined by X(f) =cos(bt +0) is mean ergodic`;

const prp2018 = `Jaypee Institute of Information Technology, Noida
in End Term Examination, 2018 rd ~
B.Tech II Semester
Course Title : Probability & Random Processes Maximum Time : 2 Hrs. |
Course Code : 15B11MA301 Maximum Marks : 35
ort Consider the probability density function f(x) = ae, -0<x<o0. [3M]
Qi the mean and variance of the binomial distribution are 6 and 1.5 [4M]
03 itx (t)= A+ Bsin(wt + ¢), where 4, B and gare independent ' [4M]
Qf Find the average power of the random process [4M]
distribution. [4M]
0 1 0 . : PL X,=2X,=1] (Steady state solution, if possible. [4M]
horse? [4M]
"arrives at office before 9:00 am. [4M]
constants C; and C, (ify joint pdf of X and Y, (i) PI6A5 <X <0.5/Y = 0.625) [4M] .
[-RT3`;

describe("extractPaperMeta", () => {
  it("reads an OCR'd end-term with misread question numbers (QI, QS)", () => {
    expect(extractPaperMeta(prp2016, [{ code: "15B11MA301", title: "x" }], now)).toMatchObject({
      course_code: "15B11MA301",
      term: "T3",
      year: 2016,
      total_marks: 35,
      num_questions: 9,
    });
  });

  it("counts questions by marks tags when OCR loses the numbering", () => {
    expect(extractPaperMeta(prp2018, [{ code: "15B11MA301", title: "x" }], now)).toMatchObject({
      course_code: "15B11MA301",
      term: "T3",
      year: 2018,
      total_marks: 35,
      num_questions: 9,
    });
  });

  it("reads a real maths paper, including the OCR'd '04.' and '06.'", () => {
    expect(extractPaperMeta(maths, courses, now)).toMatchObject({
      course_code: "15B11MA111",
      term: "T2",
      year: 2023,
      total_marks: 20,
      num_questions: 6,
    });
  });

  it("reads a real physics paper", () => {
    expect(extractPaperMeta(physics, courses, now)).toMatchObject({
      course_code: "15B11PH111",
      term: "T2",
      year: 2023,
      total_marks: 20,
      num_questions: 4,
    });
  });

  it("falls back to the course title and end-sem wording", () => {
    const text = "End Semester Examination Even 2024\nPhysics-1\nMax. Marks 35";
    expect(extractPaperMeta(text, courses, now)).toMatchObject({
      course_code: "15B11PH111",
      term: "T3",
      year: 2024,
      total_marks: 35,
    });
  });

  it("returns nothing for a blank (image-only) scan", () => {
    expect(extractPaperMeta("", courses, now)).toEqual({});
  });
});

describe("courses not in the list", () => {
  const header = `Jaypee Institute of Information Technology, Noida
End Term Examination: EVEN Semester 2023
4 B.Tech. VI Semester B
Course Title: Project Management Maximum Time: 2 Hrs.
CourseCode:16BINHS631 Maximum Marks:35`;

  it("reads letter-bearing codes, fixing OCR's I for 1, plus title and semester", () => {
    expect(extractPaperMeta(header, [], now)).toMatchObject({
      course_code: "16B1NHS631",
      course_title: "Project Management",
      semester: 6,
      term: "T3",
      year: 2023,
      total_marks: 35,
    });
  });

  it("cuts the title at a slash of alternate titles", () => {
    const text = "Course Title: Probability and Random Processes/\nCourse Code: 15B11MA301";
    expect(extractPaperMeta(text, [], now)).toMatchObject({
      course_title: "Probability and Random Processes",
      semester: 3,
    });
  });

  it("counts questions across all pages", () => {
    const text = "Q1. a\nQ2. b\n\f\nQ3. c\nQ4. d\nQ5. e";
    expect(extractPaperMeta(text, [], now).num_questions).toBe(5);
  });
});
