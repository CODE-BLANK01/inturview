import type { Problem } from "./types";

export const TOPICS = [
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Binary Search",
  "Linked List",
  "Trees",
  "Tries",
  "Heap / Priority Queue",
  "Backtracking",
  "Graphs",
  "Advanced Graphs",
  "1D DP",
  "2D DP",
  "Greedy",
  "Intervals",
  "Math & Geometry",
  "Bit Manipulation",
] as const;

export const PROBLEMS: Problem[] = [
  // Arrays & Hashing
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topic: "Arrays & Hashing",
    leetcode_url: "https://leetcode.com/problems/two-sum/",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume each input has exactly one solution, and you may not use the same element twice.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists.",
    ],
    optimal_time: "O(n)",
    optimal_space: "O(n)",
    tags: ["hash map", "array"],
  },
  {
    id: "valid-anagram",
    title: "Valid Anagram",
    difficulty: "Easy",
    topic: "Arrays & Hashing",
    leetcode_url: "https://leetcode.com/problems/valid-anagram/",
    description:
      "Given two strings s and t, return true if t is an anagram of s, and false otherwise.",
    examples: [
      { input: 's = "anagram", t = "nagaram"', output: "true" },
      { input: 's = "rat", t = "car"', output: "false" },
    ],
    constraints: ["1 <= s.length, t.length <= 5 * 10^4", "s and t consist of lowercase English letters."],
    optimal_time: "O(n)",
    optimal_space: "O(1)",
    tags: ["hash map", "string", "counting"],
  },
  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    topic: "Arrays & Hashing",
    leetcode_url: "https://leetcode.com/problems/group-anagrams/",
    description:
      "Given an array of strings strs, group the anagrams together. You can return the answer in any order.",
    examples: [
      {
        input: 'strs = ["eat","tea","tan","ate","nat","bat"]',
        output: '[["bat"],["nat","tan"],["ate","eat","tea"]]',
      },
    ],
    constraints: ["1 <= strs.length <= 10^4", "0 <= strs[i].length <= 100", "strs[i] consists of lowercase English letters."],
    optimal_time: "O(n*k)",
    optimal_space: "O(n*k)",
    tags: ["hash map", "string", "sorting"],
  },
  {
    id: "top-k-frequent-elements",
    title: "Top K Frequent Elements",
    difficulty: "Medium",
    topic: "Arrays & Hashing",
    leetcode_url: "https://leetcode.com/problems/top-k-frequent-elements/",
    description:
      "Given an integer array nums and an integer k, return the k most frequent elements. You may return the answer in any order.",
    examples: [
      { input: "nums = [1,1,1,2,2,3], k = 2", output: "[1,2]" },
      { input: "nums = [1], k = 1", output: "[1]" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "k is in the range [1, the number of unique elements in the array]."],
    optimal_time: "O(n)",
    optimal_space: "O(n)",
    tags: ["hash map", "bucket sort", "heap"],
  },

  // Two Pointers
  {
    id: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "Easy",
    topic: "Two Pointers",
    leetcode_url: "https://leetcode.com/problems/valid-palindrome/",
    description:
      "A phrase is a palindrome if, after converting all uppercase letters into lowercase and removing all non-alphanumeric characters, it reads the same forward and backward. Return true if it is a palindrome.",
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: "true" },
      { input: 's = "race a car"', output: "false" },
    ],
    constraints: ["1 <= s.length <= 2 * 10^5", "s consists only of printable ASCII characters."],
    optimal_time: "O(n)",
    optimal_space: "O(1)",
    tags: ["two pointers", "string"],
  },
  {
    id: "3sum",
    title: "3Sum",
    difficulty: "Medium",
    topic: "Two Pointers",
    leetcode_url: "https://leetcode.com/problems/3sum/",
    description:
      "Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i, j, k are distinct indices and nums[i] + nums[j] + nums[k] == 0. The solution set must not contain duplicate triplets.",
    examples: [
      { input: "nums = [-1,0,1,2,-1,-4]", output: "[[-1,-1,2],[-1,0,1]]" },
      { input: "nums = [0,1,1]", output: "[]" },
    ],
    constraints: ["3 <= nums.length <= 3000", "-10^5 <= nums[i] <= 10^5"],
    optimal_time: "O(n^2)",
    optimal_space: "O(1)",
    tags: ["two pointers", "sorting"],
  },

  // Sliding Window
  {
    id: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    topic: "Sliding Window",
    leetcode_url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/",
    description:
      "You are given an array prices where prices[i] is the price of a given stock on the ith day. Maximize profit by choosing a single day to buy one stock and a different future day to sell. Return the maximum profit (0 if no profit possible).",
    examples: [
      { input: "prices = [7,1,5,3,6,4]", output: "5" },
      { input: "prices = [7,6,4,3,1]", output: "0" },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    optimal_time: "O(n)",
    optimal_space: "O(1)",
    tags: ["sliding window", "greedy"],
  },
  {
    id: "longest-substring-without-repeating-characters",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    topic: "Sliding Window",
    leetcode_url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    description:
      "Given a string s, find the length of the longest substring without repeating characters.",
    examples: [
      { input: 's = "abcabcbb"', output: "3" },
      { input: 's = "bbbbb"', output: "1" },
      { input: 's = "pwwkew"', output: "3" },
    ],
    constraints: ["0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols and spaces."],
    optimal_time: "O(n)",
    optimal_space: "O(min(n, m))",
    tags: ["sliding window", "hash set"],
  },

  // Stack
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    topic: "Stack",
    leetcode_url: "https://leetcode.com/problems/valid-parentheses/",
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if open brackets are closed by the same type and in the correct order.",
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "()[]{}"', output: "true" },
      { input: 's = "(]"', output: "false" },
    ],
    constraints: ["1 <= s.length <= 10^4"],
    optimal_time: "O(n)",
    optimal_space: "O(n)",
    tags: ["stack", "string"],
  },
  {
    id: "daily-temperatures",
    title: "Daily Temperatures",
    difficulty: "Medium",
    topic: "Stack",
    leetcode_url: "https://leetcode.com/problems/daily-temperatures/",
    description:
      "Given an array of integers temperatures representing daily temperatures, return an array answer where answer[i] is the number of days you have to wait after the ith day to get a warmer temperature. If there is no future day, put 0.",
    examples: [
      { input: "temperatures = [73,74,75,71,69,72,76,73]", output: "[1,1,4,2,1,1,0,0]" },
      { input: "temperatures = [30,40,50,60]", output: "[1,1,1,0]" },
    ],
    constraints: ["1 <= temperatures.length <= 10^5", "30 <= temperatures[i] <= 100"],
    optimal_time: "O(n)",
    optimal_space: "O(n)",
    tags: ["monotonic stack"],
  },

  // Binary Search
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    topic: "Binary Search",
    leetcode_url: "https://leetcode.com/problems/binary-search/",
    description:
      "Given a sorted (ascending) array of integers nums and an integer target, search for target. If it exists, return its index. Otherwise, return -1. The algorithm must run in O(log n).",
    examples: [
      { input: "nums = [-1,0,3,5,9,12], target = 9", output: "4" },
      { input: "nums = [-1,0,3,5,9,12], target = 2", output: "-1" },
    ],
    constraints: ["1 <= nums.length <= 10^4", "All integers in nums are unique."],
    optimal_time: "O(log n)",
    optimal_space: "O(1)",
    tags: ["binary search"],
  },
  {
    id: "find-minimum-in-rotated-sorted-array",
    title: "Find Minimum in Rotated Sorted Array",
    difficulty: "Medium",
    topic: "Binary Search",
    leetcode_url: "https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/",
    description:
      "Suppose an array of unique integers, originally sorted in ascending order, is rotated between 1 and n times. Given the rotated array nums, return the minimum element. Must run in O(log n).",
    examples: [
      { input: "nums = [3,4,5,1,2]", output: "1" },
      { input: "nums = [4,5,6,7,0,1,2]", output: "0" },
    ],
    constraints: ["n == nums.length", "1 <= n <= 5000", "All the integers of nums are unique."],
    optimal_time: "O(log n)",
    optimal_space: "O(1)",
    tags: ["binary search"],
  },

  // Linked List
  {
    id: "reverse-linked-list",
    title: "Reverse Linked List",
    difficulty: "Easy",
    topic: "Linked List",
    leetcode_url: "https://leetcode.com/problems/reverse-linked-list/",
    description: "Given the head of a singly linked list, reverse the list, and return the reversed list.",
    examples: [
      { input: "head = [1,2,3,4,5]", output: "[5,4,3,2,1]" },
      { input: "head = []", output: "[]" },
    ],
    constraints: ["The number of nodes in the list is the range [0, 5000].", "-5000 <= Node.val <= 5000"],
    optimal_time: "O(n)",
    optimal_space: "O(1)",
    tags: ["linked list"],
  },
  {
    id: "merge-two-sorted-lists",
    title: "Merge Two Sorted Lists",
    difficulty: "Easy",
    topic: "Linked List",
    leetcode_url: "https://leetcode.com/problems/merge-two-sorted-lists/",
    description:
      "Merge two sorted linked lists and return the head of the merged sorted list. The list should be made by splicing together the nodes of the first two lists.",
    examples: [
      { input: "list1 = [1,2,4], list2 = [1,3,4]", output: "[1,1,2,3,4,4]" },
      { input: "list1 = [], list2 = []", output: "[]" },
    ],
    constraints: ["Both lists are sorted in non-decreasing order."],
    optimal_time: "O(n + m)",
    optimal_space: "O(1)",
    tags: ["linked list", "two pointers"],
  },

  // Trees
  {
    id: "invert-binary-tree",
    title: "Invert Binary Tree",
    difficulty: "Easy",
    topic: "Trees",
    leetcode_url: "https://leetcode.com/problems/invert-binary-tree/",
    description: "Given the root of a binary tree, invert the tree (mirror it), and return its root.",
    examples: [
      { input: "root = [4,2,7,1,3,6,9]", output: "[4,7,2,9,6,3,1]" },
      { input: "root = []", output: "[]" },
    ],
    constraints: ["The number of nodes in the tree is in the range [0, 100]."],
    optimal_time: "O(n)",
    optimal_space: "O(h)",
    tags: ["tree", "recursion", "bfs", "dfs"],
  },
  {
    id: "validate-binary-search-tree",
    title: "Validate Binary Search Tree",
    difficulty: "Medium",
    topic: "Trees",
    leetcode_url: "https://leetcode.com/problems/validate-binary-search-tree/",
    description:
      "Given the root of a binary tree, determine if it is a valid binary search tree (every left subtree contains only nodes with strictly smaller values, every right subtree only strictly greater).",
    examples: [
      { input: "root = [2,1,3]", output: "true" },
      { input: "root = [5,1,4,null,null,3,6]", output: "false" },
    ],
    constraints: ["The number of nodes is in the range [1, 10^4]."],
    optimal_time: "O(n)",
    optimal_space: "O(h)",
    tags: ["tree", "dfs", "bst"],
  },

  // Tries
  {
    id: "implement-trie-prefix-tree",
    title: "Implement Trie (Prefix Tree)",
    difficulty: "Medium",
    topic: "Tries",
    leetcode_url: "https://leetcode.com/problems/implement-trie-prefix-tree/",
    description:
      "A trie is a tree data structure used to efficiently store and retrieve keys in a dataset of strings. Implement Trie with insert(word), search(word), and startsWith(prefix).",
    examples: [
      {
        input: 'Trie t; t.insert("apple"); t.search("apple"); t.search("app"); t.startsWith("app"); t.insert("app"); t.search("app");',
        output: "true, false, true, true",
      },
    ],
    constraints: ["1 <= word.length, prefix.length <= 2000", "Lowercase English letters only.", "At most 3 * 10^4 calls in total."],
    optimal_time: "O(L) per op (L = word length)",
    optimal_space: "O(N) where N = total characters inserted",
    tags: ["trie", "design"],
  },

  // Heap / Priority Queue
  {
    id: "k-closest-points-to-origin",
    title: "K Closest Points to Origin",
    difficulty: "Medium",
    topic: "Heap / Priority Queue",
    leetcode_url: "https://leetcode.com/problems/k-closest-points-to-origin/",
    description:
      "Given an array of points where points[i] = [xi, yi] and an integer k, return the k closest points to the origin (0, 0). Distance is Euclidean. Answer order doesn't matter.",
    examples: [
      { input: "points = [[1,3],[-2,2]], k = 1", output: "[[-2,2]]" },
      { input: "points = [[3,3],[5,-1],[-2,4]], k = 2", output: "[[3,3],[-2,4]]" },
    ],
    constraints: ["1 <= k <= points.length <= 10^4"],
    optimal_time: "O(n log k) heap or O(n) avg quickselect",
    optimal_space: "O(k)",
    tags: ["heap", "quickselect", "divide and conquer"],
  },
  {
    id: "find-median-from-data-stream",
    title: "Find Median From Data Stream",
    difficulty: "Hard",
    topic: "Heap / Priority Queue",
    leetcode_url: "https://leetcode.com/problems/find-median-from-data-stream/",
    description:
      "Design a data structure that supports adding numbers from a data stream and finding the running median. Implement MedianFinder with addNum(num) and findMedian().",
    examples: [
      {
        input: "addNum(1); addNum(2); findMedian(); addNum(3); findMedian();",
        output: "1.5, 2.0",
      },
    ],
    constraints: ["At most 5 * 10^4 calls to addNum and findMedian."],
    optimal_time: "O(log n) add, O(1) findMedian",
    optimal_space: "O(n)",
    tags: ["heap", "two heaps", "design"],
  },

  // Backtracking
  {
    id: "combination-sum",
    title: "Combination Sum",
    difficulty: "Medium",
    topic: "Backtracking",
    leetcode_url: "https://leetcode.com/problems/combination-sum/",
    description:
      "Given an array of distinct integers candidates and a target, return all unique combinations of candidates where chosen numbers sum to target. The same number may be chosen unlimited times.",
    examples: [
      { input: "candidates = [2,3,6,7], target = 7", output: "[[2,2,3],[7]]" },
      { input: "candidates = [2,3,5], target = 8", output: "[[2,2,2,2],[2,3,3],[3,5]]" },
    ],
    constraints: ["1 <= candidates.length <= 30", "All elements of candidates are distinct."],
    optimal_time: "O(N^(T/M)) where T = target, M = min candidate",
    optimal_space: "O(T/M)",
    tags: ["backtracking", "recursion"],
  },

  // Graphs
  {
    id: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    topic: "Graphs",
    leetcode_url: "https://leetcode.com/problems/number-of-islands/",
    description:
      "Given an m x n 2D grid of '1's (land) and '0's (water), return the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.",
    examples: [
      { input: 'grid = [["1","1","0"],["1","0","0"],["0","0","1"]]', output: "2" },
    ],
    constraints: ["1 <= m, n <= 300", "grid[i][j] is '0' or '1'."],
    optimal_time: "O(m*n)",
    optimal_space: "O(m*n)",
    tags: ["dfs", "bfs", "union find"],
  },
  {
    id: "clone-graph",
    title: "Clone Graph",
    difficulty: "Medium",
    topic: "Graphs",
    leetcode_url: "https://leetcode.com/problems/clone-graph/",
    description:
      "Given a reference of a node in a connected undirected graph, return a deep copy (clone) of the graph. Each node contains a value and a list of its neighbors.",
    examples: [
      { input: "adjList = [[2,4],[1,3],[2,4],[1,3]]", output: "[[2,4],[1,3],[2,4],[1,3]]" },
    ],
    constraints: ["0 <= Node.val <= 100", "The graph is connected and all nodes can be visited starting from the given node."],
    optimal_time: "O(V + E)",
    optimal_space: "O(V)",
    tags: ["dfs", "bfs", "hash map"],
  },

  // Advanced Graphs
  {
    id: "network-delay-time",
    title: "Network Delay Time",
    difficulty: "Medium",
    topic: "Advanced Graphs",
    leetcode_url: "https://leetcode.com/problems/network-delay-time/",
    description:
      "You are given a network of n nodes labeled 1..n. times[i] = (u, v, w) means signal travels from u to v in w time. Send a signal from node k. Return the time it takes for all nodes to receive the signal, or -1 if impossible.",
    examples: [
      { input: "times = [[2,1,1],[2,3,1],[3,4,1]], n = 4, k = 2", output: "2" },
    ],
    constraints: ["1 <= k <= n <= 100", "1 <= times.length <= 6000"],
    optimal_time: "O((V + E) log V) Dijkstra",
    optimal_space: "O(V + E)",
    tags: ["dijkstra", "shortest path", "heap"],
  },

  // 1D DP
  {
    id: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: "Easy",
    topic: "1D DP",
    leetcode_url: "https://leetcode.com/problems/climbing-stairs/",
    description:
      "You are climbing a staircase with n steps. Each time you can climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    examples: [
      { input: "n = 2", output: "2" },
      { input: "n = 3", output: "3" },
    ],
    constraints: ["1 <= n <= 45"],
    optimal_time: "O(n)",
    optimal_space: "O(1)",
    tags: ["dp", "fibonacci"],
  },
  {
    id: "house-robber",
    title: "House Robber",
    difficulty: "Medium",
    topic: "1D DP",
    leetcode_url: "https://leetcode.com/problems/house-robber/",
    description:
      "Each house has some money. Adjacent houses have connected alarms. Return the maximum amount of money you can rob without robbing two adjacent houses.",
    examples: [
      { input: "nums = [1,2,3,1]", output: "4" },
      { input: "nums = [2,7,9,3,1]", output: "12" },
    ],
    constraints: ["1 <= nums.length <= 100", "0 <= nums[i] <= 400"],
    optimal_time: "O(n)",
    optimal_space: "O(1)",
    tags: ["dp"],
  },

  // 2D DP
  {
    id: "longest-common-subsequence",
    title: "Longest Common Subsequence",
    difficulty: "Medium",
    topic: "2D DP",
    leetcode_url: "https://leetcode.com/problems/longest-common-subsequence/",
    description:
      "Given two strings text1 and text2, return the length of their longest common subsequence. A subsequence keeps relative order but is not necessarily contiguous.",
    examples: [
      { input: 'text1 = "abcde", text2 = "ace"', output: "3" },
      { input: 'text1 = "abc", text2 = "def"', output: "0" },
    ],
    constraints: ["1 <= text1.length, text2.length <= 1000"],
    optimal_time: "O(n*m)",
    optimal_space: "O(n*m)",
    tags: ["dp", "string"],
  },

  // Greedy
  {
    id: "jump-game",
    title: "Jump Game",
    difficulty: "Medium",
    topic: "Greedy",
    leetcode_url: "https://leetcode.com/problems/jump-game/",
    description:
      "You are given an integer array nums. You're at index 0. nums[i] is your max jump length from i. Return true if you can reach the last index.",
    examples: [
      { input: "nums = [2,3,1,1,4]", output: "true" },
      { input: "nums = [3,2,1,0,4]", output: "false" },
    ],
    constraints: ["1 <= nums.length <= 10^4", "0 <= nums[i] <= 10^5"],
    optimal_time: "O(n)",
    optimal_space: "O(1)",
    tags: ["greedy", "array"],
  },

  // Intervals
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    topic: "Intervals",
    leetcode_url: "https://leetcode.com/problems/merge-intervals/",
    description:
      "Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals and return an array of the non-overlapping intervals that cover all input intervals.",
    examples: [
      { input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]" },
      { input: "intervals = [[1,4],[4,5]]", output: "[[1,5]]" },
    ],
    constraints: ["1 <= intervals.length <= 10^4", "intervals[i].length == 2"],
    optimal_time: "O(n log n)",
    optimal_space: "O(n)",
    tags: ["sorting", "array"],
  },

  // Math & Geometry
  {
    id: "rotate-image",
    title: "Rotate Image",
    difficulty: "Medium",
    topic: "Math & Geometry",
    leetcode_url: "https://leetcode.com/problems/rotate-image/",
    description:
      "You are given an n x n 2D matrix representing an image. Rotate the image 90 degrees clockwise in place — you must modify the input matrix directly without allocating another 2D matrix.",
    examples: [
      { input: "matrix = [[1,2,3],[4,5,6],[7,8,9]]", output: "[[7,4,1],[8,5,2],[9,6,3]]" },
    ],
    constraints: ["n == matrix.length == matrix[i].length", "1 <= n <= 20"],
    optimal_time: "O(n^2)",
    optimal_space: "O(1)",
    tags: ["matrix", "math"],
  },

  // Bit Manipulation
  {
    id: "number-of-1-bits",
    title: "Number of 1 Bits",
    difficulty: "Easy",
    topic: "Bit Manipulation",
    leetcode_url: "https://leetcode.com/problems/number-of-1-bits/",
    description:
      "Write a function that takes the binary representation of a positive integer and returns the number of set bits (Hamming weight).",
    examples: [
      { input: "n = 11 (binary 1011)", output: "3" },
      { input: "n = 128 (binary 10000000)", output: "1" },
    ],
    constraints: ["1 <= n <= 2^31 - 1"],
    optimal_time: "O(k) where k = number of set bits (Brian Kernighan)",
    optimal_space: "O(1)",
    tags: ["bit manipulation"],
  },
];

export function getProblem(id: string): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}
