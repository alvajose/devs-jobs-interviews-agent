import type { RoadmapModule } from "./types";

// The ONE exception to the in-app content policy: coding-practice links OUT to real exercises.
// The app owns these URLs, the model is never allowed to invent external links, so we attach
// them here by module id after generation.
export const CODING_PRACTICE_RESOURCE = {
  label: "Grind 75, full curated list",
  url: "https://www.techinterviewhandbook.org/grind75/",
} as const;

// The 24 Easy problems from Grind 75 (Blind 75 author's curated list), grouped by pattern,
// a sensible progression to work through. Direct LeetCode links; the resource above is the full list.
const GRIND75_STARTER: { title: string; url: string; difficulty: string }[] = [
  {
    title: "Two Sum",
    url: "https://leetcode.com/problems/two-sum/",
    difficulty: "Easy",
  },
  {
    title: "Best Time to Buy and Sell Stock",
    url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/",
    difficulty: "Easy",
  },
  {
    title: "Majority Element",
    url: "https://leetcode.com/problems/majority-element/",
    difficulty: "Easy",
  },
  {
    title: "Contains Duplicate",
    url: "https://leetcode.com/problems/contains-duplicate/",
    difficulty: "Easy",
  },
  {
    title: "Ransom Note",
    url: "https://leetcode.com/problems/ransom-note/",
    difficulty: "Easy",
  },
  {
    title: "Valid Palindrome",
    url: "https://leetcode.com/problems/valid-palindrome/",
    difficulty: "Easy",
  },
  {
    title: "Valid Anagram",
    url: "https://leetcode.com/problems/valid-anagram/",
    difficulty: "Easy",
  },
  {
    title: "Longest Palindrome",
    url: "https://leetcode.com/problems/longest-palindrome/",
    difficulty: "Easy",
  },
  {
    title: "Valid Parentheses",
    url: "https://leetcode.com/problems/valid-parentheses/",
    difficulty: "Easy",
  },
  {
    title: "Implement Queue using Stacks",
    url: "https://leetcode.com/problems/implement-queue-using-stacks/",
    difficulty: "Easy",
  },
  {
    title: "Merge Two Sorted Lists",
    url: "https://leetcode.com/problems/merge-two-sorted-lists/",
    difficulty: "Easy",
  },
  {
    title: "Linked List Cycle",
    url: "https://leetcode.com/problems/linked-list-cycle/",
    difficulty: "Easy",
  },
  {
    title: "Reverse Linked List",
    url: "https://leetcode.com/problems/reverse-linked-list/",
    difficulty: "Easy",
  },
  {
    title: "Middle of the Linked List",
    url: "https://leetcode.com/problems/middle-of-the-linked-list/",
    difficulty: "Easy",
  },
  {
    title: "Binary Search",
    url: "https://leetcode.com/problems/binary-search/",
    difficulty: "Easy",
  },
  {
    title: "First Bad Version",
    url: "https://leetcode.com/problems/first-bad-version/",
    difficulty: "Easy",
  },
  {
    title: "Invert Binary Tree",
    url: "https://leetcode.com/problems/invert-binary-tree/",
    difficulty: "Easy",
  },
  {
    title: "Balanced Binary Tree",
    url: "https://leetcode.com/problems/balanced-binary-tree/",
    difficulty: "Easy",
  },
  {
    title: "Diameter of Binary Tree",
    url: "https://leetcode.com/problems/diameter-of-binary-tree/",
    difficulty: "Easy",
  },
  {
    title: "Maximum Depth of Binary Tree",
    url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/",
    difficulty: "Easy",
  },
  {
    title: "Lowest Common Ancestor of a Binary Search Tree",
    url: "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/",
    difficulty: "Easy",
  },
  {
    title: "Flood Fill",
    url: "https://leetcode.com/problems/flood-fill/",
    difficulty: "Easy",
  },
  {
    title: "Climbing Stairs",
    url: "https://leetcode.com/problems/climbing-stairs/",
    difficulty: "Easy",
  },
  {
    title: "Add Binary",
    url: "https://leetcode.com/problems/add-binary/",
    difficulty: "Easy",
  },
];

const PRACTICE_ID = "coding-practice";

function isPracticeModule(m: RoadmapModule): boolean {
  if (m.id === PRACTICE_ID) return true;
  const t = `${m.title}`.toLowerCase();
  return (
    t.includes("practic") && (t.includes("cod") || t.includes("algorithm"))
  );
}

/**
 * Attach the external coding-exercises link + the curated Grind 75 starter problems (direct links,
 * recommended order) to the practice module(s). Everything else stays in-app.
 */
export function attachPracticeResource(
  modules: RoadmapModule[],
): RoadmapModule[] {
  return modules.map((m) =>
    isPracticeModule(m)
      ? {
          ...m,
          resource: CODING_PRACTICE_RESOURCE,
          exercises: [...GRIND75_STARTER],
        }
      : m,
  );
}
