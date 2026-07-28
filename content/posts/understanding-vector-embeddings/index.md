---
title: "Understanding Vector Embeddings: A Beginner's Guide"
date: 2024-09-14T23:00:00.013+04:00
lastmod: 2024-10-05T23:47:39.652+04:00
slug: "understanding-vector-embeddings"
sourceURL: "https://www.subhashdasyam.com/2024/09/understanding-vector-embeddings.html"
---
In the world of artificial intelligence and natural language processing, vector embeddings play a crucial role. But what exactly are they, and why are they so important? This blog post will break down the concept of vector embeddings in simple terms, making it accessible for beginners. We'll explore what they are, how they work, and why they're used in various applications.

## What are Vector Embeddings?

Imagine you're trying to teach a computer to understand language. Unlike humans, computers can't directly comprehend words or sentences. They need everything translated into numbers. This is where vector embeddings come in.

A vector embedding is a way to represent words, sentences, or even entire documents as lists of numbers. These numbers capture the meaning and relationships between different pieces of text in a way that computers can understand and work with.

### The Magic Library Analogy

To understand this better, let's imagine a magical library:

- Instead of books, this library contains colors.
- Each color represents a word or a piece of text.
- You have special glasses that let you see each color as a mix of red, green, and blue (RGB).

In this analogy:

- The colors are like words or text.
- The special glasses are like the embedding process.
- The RGB values (e.g., 50% red, 30% green, 80% blue) are like the vector embedding.

This detailed view (the RGB values) gives you more information about the color (word) than just its name, allowing for more precise comparisons and analysis.

## How Do Vector Embeddings Work?

The process of creating vector embeddings involves several steps:

1. Tokenization: The text is split into words or subwords.
2. Encoding: Each token is converted into a vector of numbers by a neural network.
3. Combination: For longer pieces of text, these individual vectors are combined to create a final vector representing the entire text.

## From Words to Numbers: The Magic of Vector Embeddings

Have you ever wondered how a computer understands language? Let's dive into the fascinating world of vector embeddings and see how a simple sentence transforms into numbers that a computer can comprehend.

### A Simple Analogy: The Color Palette

Imagine you're an artist with a unique color palette. Instead of naming colors, you describe them using three numbers representing the amount of red, green, and blue (RGB). For example:

- Sky Blue might be [135, 206, 235]
- Forest Green could be [34, 139, 34]

In this analogy:

- Colors are like words
- The RGB values are like vector embeddings

Just as the RGB values capture the essence of a color, vector embeddings capture the essence of words or sentences.

### From Sentence to Numbers: A Step-by-Step Journey

Let's take a simple sentence and see how it transforms into vector embeddings:

"The curious cat explored the garden."

#### 1. One-Hot Encoding

This is the simplest form of embedding. Each word gets a unique position in a long vector.

```

[1, 0, 0, 0, 0] = The
[0, 1, 0, 0, 0] = curious
[0, 0, 1, 0, 0] = cat
[0, 0, 0, 1, 0] = explored
[1, 0, 0, 0, 0] = the
[0, 0, 0, 0, 1] = garden

```

The sentence becomes: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1]

Limitation: This method doesn't capture any meaning or relationships between words.

#### 2. TF-IDF (Term Frequency-Inverse Document Frequency)

TF-IDF is a statistical measure used to evaluate the importance of a word in a document within a collection (corpus) of documents.

How it works:

1. Term Frequency (TF): How often a word appears in a document. TF(word) = (Number of times the word appears in the document) / (Total number of words in the document)
2. Inverse Document Frequency (IDF): How rare or common a word is across all documents. IDF(word) = log(Total number of documents / Number of documents containing the word)
3. TF-IDF = TF * IDF

Let's use our sentence in a practical example:

"The curious cat explored the garden."

Assume we have a corpus of 1,000 documents about animals and nature.

Calculation for "curious":

- TF("curious") = 1 / 6 (appears once in our 6-word sentence)
- Assume "curious" appears in 100 documents
- IDF("curious") = log(1000 / 100) = log(10) ≈ 2.30
- TF-IDF("curious") = (1/6) * 2.30 ≈ 0.38

Similarly, let's calculate for "the":

- TF("the") = 2 / 6 (appears twice in our sentence)
- Assume "the" appears in 1000 documents (very common)
- IDF("the") = log(1000 / 1000) = log(1) = 0
- TF-IDF("the") = (2/6) * 0 = 0

This shows how common words like "the" get a lower score, while more unique or informative words get higher scores.

The TF-IDF vector for our sentence might look like: [0, 0.38, 0.45, 0.52, 0, 0.41]

Where each number represents the TF-IDF score for ["The", "curious", "cat", "explored", "the", "garden"] respectively.

#### 3. Word Embeddings (e.g., Word2Vec)

Word2Vec is a neural network-based method for creating word embeddings. It learns vector representations of words by looking at the contexts in which words appear.

How Word2Vec works:

It trains a shallow neural network to perform one of two tasks:

- Skip-gram: Predict context words given a target word.
- Continuous Bag of Words (CBOW): Predict a target word given context words.

Let's break down how "The" might be converted to [0.2, -0.5, 0.1, 0.3]:

1. After training, the weights of the neural network become the word embeddings.
2. Initially, "The" is randomly assigned a vector, say [0.1, 0.1, 0.1, 0.1].
3. The model looks at many contexts where "The" appears, e.g., "The cat", "The dog", "The house".
4. It adjusts the vector to be similar to other determiners and words that often appear in similar contexts.
5. Through many iterations, it might end up with [0.2, -0.5, 0.1, 0.3].

Each dimension in this vector represents a learned feature. While we can't always interpret what each dimension means, the overall vector captures semantic and syntactic properties of the word.

Practical example:

Let's say we have these word vectors after training:

```

"The": [0.2, -0.5, 0.1, 0.3]
"A": [0.1, -0.4, 0.2, 0.2]
"Cat": [0.5, 0.1, 0.6, -0.2]
"Dog": [0.4, 0.2, 0.5, -0.1]

```

We can see that:

- "The" and "A" have similar vectors because they're both determiners.
- "Cat" and "Dog" have similar vectors because they're both animals.

We can use these vectors to find relationships:

- Vector("King") - Vector("Man") + Vector("Woman") ≈ Vector("Queen")

This allows the model to capture complex relationships between words.

To get a sentence embedding, we might average the word vectors:

"The curious cat" ≈ ([0.2, -0.5, 0.1, 0.3] + [0.7, 0.2, -0.1, 0.5] + [0.5, 0.1, 0.6, -0.2]) / 3 ≈ [0.47, -0.07, 0.2, 0.2]

This final vector represents the meaning of the entire phrase, capturing the semantic content of all three words.

# Word Embedding Game

Click on the word that you think is most similar to the highlighted word!

New Round

### Modern Embeddings: Understanding Sentences as a Whole

While word embeddings are powerful, they don't capture the full context of a sentence. This is where sentence embeddings come in.

#### BERT (Bidirectional Encoder Representations from Transformers)

BERT is like a super-smart reader that looks at the entire sentence in both directions to understand context.

How it works:

1. It tokenizes the sentence: ["The", "cur", "##ious", "cat", "explored", "the", "garden"]
2. It processes these tokens through multiple layers, paying attention to how each word relates to every other word.
3. It produces a vector for each token and for the entire sentence.

Our sentence "The curious cat explored the garden" might become a vector like: [0.32, -0.75, 0.21, 0.44, -0.12, 0.65, ..., 0.18]

This vector captures not just individual word meanings, but how they interact in this specific sentence.

# BERT Sentence Processing Visualization

Process Sentence

Generate Sentence Vector

### Enter N-grams: Capturing Word Relationships

While the methods above are powerful, they can sometimes miss important phrases or word combinations. This is where N-grams come in.

#### What's the Problem?

Imagine two sentences:

1. "The White House announced a new policy."
2. "I painted my house white last week."

Word-by-word embeddings might not capture that "White House" in the first sentence is a specific entity, different from a house that is white in color.

#### N-grams to the Rescue!

N-grams are contiguous sequences of N items from a given sample of text. They help capture these important word combinations.

Types of N-grams:

1. Unigrams (N=1): Single words
2. Bigrams (N=2): Two consecutive words
3. Trigrams (N=3): Three consecutive words

Let's break down our sentence:

"The curious cat explored the garden."

- Unigrams: ["The", "curious", "cat", "explored", "the", "garden"]
- Bigrams: ["The curious", "curious cat", "cat explored", "explored the", "the garden"]
- Trigrams: ["The curious cat", "curious cat explored", "cat explored the", "explored the garden"]

#### Why Use N-grams?

1. Capture Phrases: "New York" means something different than "New" and "York" separately.
2. Understand Context: "Not happy" has a different meaning than "happy".
3. Improve Predictions: In "The cat sat on the ___", knowing the previous words helps predict "mat" or "chair".

#### Practical Example: Sentiment Analysis

Consider these two reviews:

1. "The food was not good at all."
2. "The food was good."

Using just unigrams, both sentences contain "food" and "good", possibly indicating positive sentiment. But the bigram "not good" in the first sentence captures the negative sentiment accurately.

### Putting It All Together

By combining modern embedding techniques like BERT with N-gram analysis, we can create rich, context-aware representations of text. This allows computers to better understand the nuances of language, improving everything from search engines to sentiment analysis and beyond.

Remember, the next time you type a sentence, imagine the complex dance of numbers happening behind the scenes, turning your words into a language that computers can understand and reason with!

# N-gram Visualization Game

Generate N-grams

### Unigrams

### Bigrams

### Trigrams

Analyze Sentiment

### A Practical Example: Recipe Finder

Let's say we're building a recipe finder application. We have thousands of recipes, and we want users to find recipes similar to what they're looking for, even if they don't use the exact same words.

Here's how it might work:

#### 1. Preparing the Data:

For simplicity, let's say our model uses just 3 numbers for each embedding:

- "Spicy Chicken Tacos" → [0.8, 0.6, 0.3]
- "Vegetarian Bean Burrito" → [0.7, 0.5, 0.4]
- "Grilled Cheese Sandwich" → [0.2, 0.9, 0.5]

#### 2. Searching:

- We store these vectors in our database, linked to their respective recipes.
- A user searches for "Spicy Vegetable Wrap".
- We convert this search query into numbers: [0.75, 0.55, 0.35]
- Our system compares this vector to all the stored vectors, finding the closest matches.
- It might find that "Spicy Chicken Tacos" and "Vegetarian Bean Burrito" are the closest matches.
- We show these recipes to the user, even though they don't contain the exact words "vegetable" or "wrap".

This works because:

- The embedding captures that "spicy" is important, matching with "Spicy Chicken Tacos".
- It understands that "vegetable" is similar to "vegetarian", matching with "Vegetarian Bean Burrito".
- "Wrap", "taco", and "burrito" are all similar types of foods, so they're represented similarly in the embedding.

## Why Use Vector Embeddings?

Vector embeddings offer several advantages:

1. Speed: Comparing numbers is much faster for computers than comparing words, especially with large datasets.
2. Understanding: They help computers grasp meaning, not just exact word matches.
3. Flexibility: Users can find relevant results even if they don't know the exact words to use.

## Important Concepts in Vector Embeddings

### 1. Normalization

In vector embeddings, you'll often see numbers between -1 and 1 (or 0 and 1). This is due to a process called normalization, which has several benefits:

- Scale Independence: It allows for meaningful comparisons between different embeddings.
- Consistent Interpretation: It makes it easier to understand the relative importance of different features.
- Mathematical Stability: It helps avoid computational issues in machine learning algorithms.

### Scale Independence:

Imagine comparing the heights of a mouse (about 10 cm) and an elephant (about 300 cm). The raw numbers are very different. If we normalize these to a 0-1 scale, we might get:

- Mouse: 0.03
- Elephant: 1.0

Now we can easily see that the elephant is about 33 times taller than the mouse (1.0 / 0.03), which wasn't immediately obvious from the raw numbers.

### Consistent Interpretation:

If you're comparing customer ratings, raw numbers might be:

- Product A: 45 out of 50
- Product B: 8 out of 10

Normalized to a 0-1 scale:

- Product A: 0.9
- Product B: 0.8

Now it's clear that Product A has a slightly higher rating, which wasn't immediately obvious from the raw scores.

### Mathematical Stability:

In machine learning, very large or small numbers can cause computational problems. Keeping all numbers in a small, consistent range helps avoid these issues.

### Example:

Raw vector: [1000, 2000, 3000]

Normalized vector: [0.33, 0.67, 1.0]

The normalized vector is easier for computers to work with without losing the relative relationships between the numbers.

Now we can easily see that the elephant is about 33 times taller than the mouse.

### 2. Aggregation and Information Loss

When dealing with large documents, we often need to combine (aggregate) multiple vector embeddings into one. While this can lead to some information loss, it's often a necessary trade-off for efficiency:

Why Aggregate?

### Storage Efficiency:

Storing one vector per document uses less space than storing many vectors per document.

### Query Speed:

Comparing one vector per document is faster than comparing many vectors per document.

### Information Retention:

While some detail is lost, the averaged vector still captures the overall "theme" or "topic" of the document.

### Example:

Chunk 1 (about climate): [0.8, 0.2, 0.1]

Chunk 2 (about oceans): [0.3, 0.7, 0.2]

Chunk 3 (about forests): [0.4, 0.3, 0.6]

Averaged: [0.5, 0.4, 0.3]

The averaged vector still indicates that the document is primarily about environmental topics, even if it loses the specific breakdown.

### Alternative Approaches:

- Multiple Vectors: Some systems store multiple vectors per document for more granular matching.
- Hierarchical Embeddings: Create embeddings at different levels (sentence, paragraph, document) for flexible querying.

The choice depends on the specific use case, balancing accuracy against computational resources.

### 3. Similarity Measures: Cosine Similarity vs Euclidean Distance

When comparing vector embeddings, two common methods are Cosine Similarity and Euclidean Distance:

Cosine Similarity:

- Measures the angle between two vectors, ignoring their length.
- Range: -1 to 1 (1 being most similar)
- Good for comparing the topic or direction, regardless of intensity.

Euclidean Distance:

- Measures the straight-line distance between two points in space.
- Range: 0 to infinity (0 being identical)
- Good when both the direction and magnitude matter.

Let's break this down step by step:

### Vectors:

Think of a vector as an arrow pointing in space. It has both direction and length.

### Magnitude:

Magnitude is the length of the vector. It's how far the arrow extends from its starting point.

### Cosine Similarity:

This measures the angle between two vectors, ignoring their length.

Range: -1 to 1

- 1: Vectors point in the same direction (very similar)
- 0: Vectors are perpendicular (unrelated)
- -1: Vectors point in opposite directions (opposite meaning)

### Example:

Imagine two book reviews:

- Review 1: "Great plot, awesome characters!"
- Review 2: "Fantastic storyline, amazing character development!"

These might have high cosine similarity because they're about the same topics, even if one review is longer (has greater magnitude).

### Euclidean Distance:

This measures the straight-line distance between the tips of two vectors.

Range: 0 to infinity

- 0: Vectors are identical
- Larger numbers mean vectors are farther apart (less similar)

### Example:

Compare two weather reports:

- Report 1: "Sunny, 25°C"
- Report 2: "Sunny, 26°C"

These might have a small Euclidean distance because they're very similar in content and length.

### When to Use Each:

- Cosine Similarity: Good when you care about the topic or direction, not the intensity or length. Often used in text analysis.
- Euclidean Distance: Good when both the direction and magnitude matter. Often used in physical or spatial problems.

### Simplified Analogy:

Imagine you're comparing two songs:

- Cosine Similarity would tell you if they're the same genre.
- Euclidean Distance would tell you if they're the same genre AND have similar length, tempo, etc.

# Fruit Similarity Game

Move the sliders to change the fruits and see how similar they are!

🍎

🍎

Compare Fruits

## Conclusion

Vector embeddings are a powerful tool in the world of natural language processing and machine learning. By representing text as numbers, they allow computers to understand and compare language in ways that are both efficient and meaningful. Whether you're building a search engine, a recommendation system, or any application that needs to understand text, vector embeddings are likely to play a crucial role.

As you delve deeper into this field, you'll encounter more complex concepts and techniques. But remember, at its core, the idea is simple: turning words into numbers in a way that captures their meaning and relationships. This fundamental concept opens up a world of possibilities in how we can make computers understand and work with human language.

Disclaimer: This AI world is vast, and I am learning as much as I can. There may be mistakes or better recommendations than what I know. If you find any, please feel free to comment and let me know - I would love to explore and learn more!
