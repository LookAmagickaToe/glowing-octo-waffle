import { Integration, Researcher, Paper, GraphData, AuthorPaperIndex } from '@/types';

export const defaultIntegrations: Integration[] = [
  {
    id: 'arxiv',
    name: 'arXiv',
    description: 'Open-access archive for scholarly articles in physics, mathematics, computer science, and more.',
    enabled: true,
    apiUrl: 'https://export.arxiv.org/api/query',
    icon: '📄',
    requiresKey: false,
  },
  {
    id: 'semantic-scholar',
    name: 'Semantic Scholar',
    description: 'AI-powered research tool with citation data, paper recommendations, and author profiles. Optional API key for higher rate limits.',
    enabled: true,
    apiUrl: 'https://api.semanticscholar.org/graph/v1',
    icon: '🔬',
    requiresKey: false,
    configFields: ['apiKey'],
    apiKey: '',
  },
  {
    id: 'openalex',
    name: 'OpenAlex',
    description: 'Free and open catalog of the world\'s scholarly papers, authors, institutions, and more. Email recommended for higher rate limits.',
    enabled: true,
    apiUrl: 'https://api.openalex.org',
    icon: '📊',
    requiresKey: false,
    configFields: ['email'],
  },
  {
    id: 'crossref',
    name: 'CrossRef',
    description: 'Official DOI registration agency with metadata for scholarly works. Email recommended for polite pool access.',
    enabled: true,
    apiUrl: 'https://api.crossref.org',
    icon: '🔗',
    requiresKey: false,
    configFields: ['email'],
  },
  {
    id: 'orcid',
    name: 'ORCID',
    description: 'Open researcher ID registry with author profiles, affiliations, and publication records.',
    enabled: true,
    apiUrl: 'https://pub.orcid.org/v3.0',
    icon: '🆔',
    requiresKey: false,
  },
  {
    id: 'unpaywall',
    name: 'Unpaywall',
    description: 'Find free, legal, full-text versions of research papers. Email required for API access.',
    enabled: false,
    apiUrl: 'https://api.unpaywall.org/v2',
    icon: '🔓',
    requiresKey: false,
    configFields: ['email'],
  },
  {
    id: 'google-scholar',
    name: 'Google Scholar',
    description: 'Freely accessible search engine for scholarly literature. Note: No official API available.',
    enabled: false,
    apiUrl: 'https://scholar.google.com',
    icon: '🎓',
    requiresKey: false,
  },
];

export const mockResearchers: Researcher[] = [
  {
    id: 'r1',
    name: 'Dr. Sarah Chen',
    affiliation: 'MIT',
    hIndex: 45,
    citations: 12500,
    papers: ['p1', 'p3', 'p5'],
  },
  {
    id: 'r2',
    name: 'Prof. James Miller',
    affiliation: 'Stanford University',
    hIndex: 62,
    citations: 28000,
    papers: ['p1', 'p2', 'p4'],
  },
  {
    id: 'r3',
    name: 'Dr. Maria Garcia',
    affiliation: 'Cambridge University',
    hIndex: 38,
    citations: 9800,
    papers: ['p2', 'p3'],
  },
  {
    id: 'r4',
    name: 'Prof. David Kim',
    affiliation: 'Berkeley',
    hIndex: 55,
    citations: 18500,
    papers: ['p4', 'p5', 'p6'],
  },
];

export const mockPapers: Paper[] = [
  {
    id: 'p1',
    title: 'Attention Is All You Need',
    authors: ['Dr. Sarah Chen', 'Prof. James Miller'],
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
    year: 2017,
    source: 'arXiv',
    citations: 85000,
    doi: '10.48550/arXiv.1706.03762',
  },
  {
    id: 'p2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: ['Prof. James Miller', 'Dr. Maria Garcia'],
    abstract: 'We introduce a new language representation model called BERT...',
    year: 2018,
    source: 'arXiv',
    citations: 72000,
    doi: '10.48550/arXiv.1810.04805',
  },
  {
    id: 'p3',
    title: 'Generative Adversarial Networks',
    authors: ['Dr. Sarah Chen', 'Dr. Maria Garcia'],
    abstract: 'We propose a new framework for estimating generative models via an adversarial process...',
    year: 2014,
    source: 'arXiv',
    citations: 58000,
    doi: '10.48550/arXiv.1406.2661',
  },
  {
    id: 'p4',
    title: 'Deep Residual Learning for Image Recognition',
    authors: ['Prof. James Miller', 'Prof. David Kim'],
    abstract: 'Deeper neural networks are more difficult to train. We present a residual learning framework...',
    year: 2015,
    source: 'arXiv',
    citations: 120000,
    doi: '10.48550/arXiv.1512.03385',
  },
  {
    id: 'p5',
    title: 'ImageNet Classification with Deep Convolutional Neural Networks',
    authors: ['Dr. Sarah Chen', 'Prof. David Kim'],
    abstract: 'We trained a large, deep convolutional neural network to classify the 1.2 million high-resolution images...',
    year: 2012,
    source: 'Google Scholar',
    citations: 95000,
    doi: '10.1145/3065386',
  },
  {
    id: 'p6',
    title: 'Dropout: A Simple Way to Prevent Neural Networks from Overfitting',
    authors: ['Prof. David Kim'],
    abstract: 'Deep neural nets with a large number of parameters are very powerful machine learning systems...',
    year: 2014,
    source: 'Elsevier',
    citations: 42000,
  },
];

// Extended mock papers for neighbor expansion
export const extendedMockPapers: Paper[] = [
  ...mockPapers,
  {
    id: 'p7',
    title: 'Neural Machine Translation by Jointly Learning to Align and Translate',
    authors: ['Dr. Sarah Chen', 'Dr. Emily Watson'],
    abstract: 'Neural machine translation is a recently proposed approach to machine translation. This paper presents attention-based approaches that learn to align and translate jointly.',
    year: 2014,
    source: 'arXiv',
    citations: 25000,
    doi: '10.48550/arXiv.1409.0473',
  },
  {
    id: 'p8',
    title: 'Sequence to Sequence Learning with Neural Networks',
    authors: ['Dr. Emily Watson', 'Prof. James Miller'],
    abstract: 'Deep Neural Networks (DNNs) are powerful models that have achieved excellent performance on difficult learning tasks.',
    year: 2014,
    source: 'arXiv',
    citations: 21000,
    doi: '10.48550/arXiv.1409.3215',
  },
  {
    id: 'p9',
    title: 'Adam: A Method for Stochastic Optimization',
    authors: ['Dr. Emily Watson', 'Dr. Alex Thompson'],
    abstract: 'We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions.',
    year: 2014,
    source: 'arXiv',
    citations: 150000,
    doi: '10.48550/arXiv.1412.6980',
  },
  {
    id: 'p10',
    title: 'Batch Normalization: Accelerating Deep Network Training',
    authors: ['Dr. Alex Thompson', 'Prof. David Kim'],
    abstract: 'Training Deep Neural Networks is complicated by the fact that the distribution of inputs to each layer changes during training.',
    year: 2015,
    source: 'arXiv',
    citations: 45000,
    doi: '10.48550/arXiv.1502.03167',
  },
  {
    id: 'p11',
    title: 'Language Models are Few-Shot Learners',
    authors: ['Dr. Sarah Chen', 'Dr. Lisa Park'],
    abstract: 'Recent work has demonstrated substantial gains on many NLP tasks and benchmarks by pre-training on a large corpus of text.',
    year: 2020,
    source: 'arXiv',
    citations: 12000,
    doi: '10.48550/arXiv.2005.14165',
  },
  {
    id: 'p12',
    title: 'CLIP: Learning Transferable Visual Models From Natural Language',
    authors: ['Dr. Lisa Park', 'Dr. Maria Garcia'],
    abstract: 'State-of-the-art computer vision systems are trained to predict a fixed set of predetermined object categories.',
    year: 2021,
    source: 'arXiv',
    citations: 8500,
    doi: '10.48550/arXiv.2103.00020',
  },
  {
    id: 'p13',
    title: 'Diffusion Models Beat GANs on Image Synthesis',
    authors: ['Dr. Lisa Park', 'Prof. Michael Brown'],
    abstract: 'We show that diffusion models can achieve image sample quality superior to the current state-of-the-art generative models.',
    year: 2021,
    source: 'arXiv',
    citations: 6000,
    doi: '10.48550/arXiv.2105.05233',
  },
  {
    id: 'p14',
    title: 'Scaling Laws for Neural Language Models',
    authors: ['Prof. Michael Brown', 'Dr. Sarah Chen'],
    abstract: 'We study empirical scaling laws for language model performance on the cross-entropy loss.',
    year: 2020,
    source: 'arXiv',
    citations: 3500,
    doi: '10.48550/arXiv.2001.08361',
  },
  {
    id: 'p15',
    title: 'ViT: An Image is Worth 16x16 Words',
    authors: ['Prof. Michael Brown', 'Dr. Alex Thompson'],
    abstract: 'While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited.',
    year: 2020,
    source: 'arXiv',
    citations: 18000,
    doi: '10.48550/arXiv.2010.11929',
  },
  {
    id: 'p16',
    title: 'EfficientNet: Rethinking Model Scaling',
    authors: ['Dr. Alex Thompson', 'Dr. Maria Garcia'],
    abstract: 'Convolutional Neural Networks are commonly developed at a fixed resource budget, and then scaled up for better accuracy.',
    year: 2019,
    source: 'arXiv',
    citations: 22000,
    doi: '10.48550/arXiv.1905.11946',
  },
  {
    id: 'p17',
    title: 'YOLO: Real-Time Object Detection',
    authors: ['Prof. James Miller', 'Dr. Kevin Zhang'],
    abstract: 'We present YOLO, a new approach to object detection. Prior work on object detection repurposes classifiers to perform detection.',
    year: 2015,
    source: 'arXiv',
    citations: 35000,
    doi: '10.48550/arXiv.1506.02640',
  },
  {
    id: 'p18',
    title: 'Faster R-CNN: Towards Real-Time Object Detection',
    authors: ['Dr. Kevin Zhang', 'Prof. David Kim'],
    abstract: 'State-of-the-art object detection networks depend on region proposal algorithms to hypothesize object locations.',
    year: 2015,
    source: 'arXiv',
    citations: 55000,
    doi: '10.48550/arXiv.1506.01497',
  },
  {
    id: 'p19',
    title: 'Mask R-CNN',
    authors: ['Dr. Kevin Zhang', 'Dr. Sarah Chen'],
    abstract: 'We present a conceptually simple, flexible, and general framework for object instance segmentation.',
    year: 2017,
    source: 'arXiv',
    citations: 28000,
    doi: '10.48550/arXiv.1703.06870',
  },
  {
    id: 'p20',
    title: 'U-Net: Convolutional Networks for Biomedical Image Segmentation',
    authors: ['Dr. Maria Garcia', 'Dr. Rachel Lee'],
    abstract: 'There is large consent that successful training of deep networks requires many thousands of annotated training samples.',
    year: 2015,
    source: 'arXiv',
    citations: 62000,
    doi: '10.48550/arXiv.1505.04597',
  },
  {
    id: 'p21',
    title: 'DeepLab: Semantic Image Segmentation',
    authors: ['Dr. Rachel Lee', 'Prof. David Kim'],
    abstract: 'In this work we address the task of semantic image segmentation with Deep Learning.',
    year: 2016,
    source: 'Google Scholar',
    citations: 18000,
    doi: '10.48550/arXiv.1606.00915',
  },
  {
    id: 'p22',
    title: 'Graph Neural Networks: A Review',
    authors: ['Dr. Rachel Lee', 'Dr. Emily Watson'],
    abstract: 'Lots of learning tasks require dealing with graph data which contains rich relation information among elements.',
    year: 2018,
    source: 'arXiv',
    citations: 9500,
    doi: '10.48550/arXiv.1812.08434',
  },
  {
    id: 'p23',
    title: 'Message Passing Neural Networks',
    authors: ['Dr. Emily Watson', 'Prof. Michael Brown'],
    abstract: 'Supervised learning on molecules has incredible potential to be useful in chemistry, drug discovery, and materials science.',
    year: 2017,
    source: 'arXiv',
    citations: 4200,
    doi: '10.48550/arXiv.1704.01212',
  },
  {
    id: 'p24',
    title: 'Variational Autoencoders',
    authors: ['Prof. Michael Brown', 'Dr. Maria Garcia'],
    abstract: 'How can we perform efficient inference and learning in directed probabilistic models with continuous latent variables.',
    year: 2013,
    source: 'arXiv',
    citations: 32000,
    doi: '10.48550/arXiv.1312.6114',
  },
  {
    id: 'p25',
    title: 'Word2Vec: Efficient Estimation of Word Representations',
    authors: ['Dr. Kevin Zhang', 'Dr. Lisa Park'],
    abstract: 'We propose two novel model architectures for computing continuous vector representations of words from very large data sets.',
    year: 2013,
    source: 'arXiv',
    citations: 48000,
    doi: '10.48550/arXiv.1301.3781',
  },
];

// Build author-paper index for efficient neighbor lookup
export const buildAuthorPaperIndex = (papers: Paper[]): AuthorPaperIndex => {
  const authorToPapers = new Map<string, string[]>();
  const paperIndex = new Map<string, Paper>();

  papers.forEach(paper => {
    paperIndex.set(paper.id, paper);
    paper.authors.forEach(author => {
      const existing = authorToPapers.get(author) || [];
      if (!existing.includes(paper.id)) {
        authorToPapers.set(author, [...existing, paper.id]);
      }
    });
  });

  return { authorToPapers, paperIndex };
};

// Mock search function
export const searchPapers = (query: string): Paper[] => {
  const lowerQuery = query.toLowerCase();
  return extendedMockPapers.filter(paper =>
    paper.title.toLowerCase().includes(lowerQuery) ||
    paper.abstract.toLowerCase().includes(lowerQuery) ||
    paper.authors.some(a => a.toLowerCase().includes(lowerQuery))
  );
};

export const generateGraphData = (): GraphData => {
  const nodes: GraphData['nodes'] = [
    ...mockResearchers.map((r) => ({
      id: r.id,
      name: r.name,
      type: 'researcher' as const,
      val: 15,
      data: r,
    })),
    ...mockPapers.map((p) => ({
      id: p.id,
      name: p.title,
      type: 'paper' as const,
      val: 10,
      data: p,
    })),
  ];

  const links: GraphData['links'] = [];

  mockResearchers.forEach((researcher) => {
    researcher.papers.forEach((paperId) => {
      links.push({
        source: researcher.id,
        target: paperId,
      });
    });
  });

  return { nodes, links };
};
