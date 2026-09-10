/**
 * Shared citation library for curriculum evidence blocks.
 *
 * Entries without a `url` are references, not links — the SidePanel renders
 * those as plain chips. Keep this list conservative: a citation here is a claim
 * that the source actually supports the evidence band it is attached to, and
 * several of these are included *because* they are the negative result.
 */
export const CITATIONS = {
  carroll1993: {
    title: "Human Cognitive Abilities — Carroll (1993)",
    type: "book",
  },
  schneider2018: {
    title: "The Cattell–Horn–Carroll Theory of Cognitive Abilities — Schneider & McGrew (2018)",
    type: "paper",
  },
  deary2010: {
    title: "The neuroscience of human intelligence differences — Deary, Penke & Johnson (2010)",
    type: "paper",
  },
  gardner1983: {
    title: "Frames of Mind — Gardner (1983)",
    type: "book",
  },
  waterhouse2006: {
    title: "Multiple Intelligences, the Mozart Effect, and Emotional Intelligence: A Critical Review — Waterhouse (2006)",
    type: "paper",
  },
  simons2016: {
    title: "Do 'Brain-Training' Programs Work? — Simons et al. (2016)",
    type: "paper",
  },
  salaGobet2019: {
    title: "Cognitive Training Does Not Enhance General Cognition — Sala & Gobet (2019)",
    type: "paper",
  },
  melby2016: {
    title: "Working memory training does not improve performance on measures of intelligence — Melby-Lervåg, Redick & Hulme (2016)",
    type: "paper",
  },
  shipstead2012: {
    title: "Is working memory training effective? — Shipstead, Redick & Engle (2012)",
    type: "paper",
  },
  baddeley2012: {
    title: "Working Memory: Theories, Models, and Controversies — Baddeley (2012)",
    type: "paper",
  },
  chase1973: {
    title: "Perception in Chess — Chase & Simon (1973)",
    type: "paper",
  },
  ericsson1995: {
    title: "Long-term working memory — Ericsson & Kintsch (1995)",
    type: "paper",
  },
  ericsson1993: {
    title: "The Role of Deliberate Practice in the Acquisition of Expert Performance — Ericsson, Krampe & Tesch-Römer (1993)",
    type: "paper",
  },
  macnamara2014: {
    title: "Deliberate Practice and Performance: A Meta-Analysis — Macnamara, Hambrick & Oswald (2014)",
    type: "paper",
  },
  roediger2006: {
    title: "Test-Enhanced Learning — Roediger & Karpicke (2006)",
    type: "paper",
  },
  karpicke2008: {
    title: "The Critical Importance of Retrieval for Learning — Karpicke & Roediger (2008)",
    type: "paper",
  },
  cepeda2006: {
    title: "Distributed Practice in Verbal Recall Tasks — Cepeda et al. (2006)",
    type: "paper",
  },
  dunlosky2013: {
    title: "Improving Students' Learning With Effective Learning Techniques — Dunlosky et al. (2013)",
    type: "paper",
  },
  bjork1994: {
    title: "Memory and Metamemory Considerations in the Training of Human Beings — Bjork (1994)",
    type: "paper",
  },
  soderstrom2015: {
    title: "Learning versus Performance: An Integrative Review — Soderstrom & Bjork (2015)",
    type: "paper",
  },
  rohrer2015: {
    title: "Interleaved Practice Improves Mathematics Learning — Rohrer, Dedrick & Stershic (2015)",
    type: "paper",
  },
  barnett2002: {
    title: "When and Where Do We Apply What We Learn? A Taxonomy for Far Transfer — Barnett & Ceci (2002)",
    type: "paper",
  },
  fsrs: {
    title: "Free Spaced Repetition Scheduler (open-source DSR implementation)",
    type: "tool",
    url: "https://github.com/open-spaced-repetition/fsrs4anki",
  },
  worthen2011: {
    title: "Mnemonology: Mnemonics for the 21st Century — Worthen & Hunt (2011)",
    type: "book",
  },
  dresler2017: {
    title: "Mnemonic Training Reshapes Brain Networks to Support Superior Memory — Dresler et al. (2017)",
    type: "paper",
  },
  miyake2000: {
    title: "The Unity and Diversity of Executive Functions — Miyake et al. (2000)",
    type: "paper",
  },
  diamond2013: {
    title: "Executive Functions — Diamond (2013), Annual Review of Psychology",
    type: "paper",
  },
  diamond2016: {
    title: "Conclusions about interventions to improve executive functions — Diamond & Ling (2016)",
    type: "paper",
  },
  unsworth2014: {
    title: "Working memory capacity and attention control — Unsworth, Fukuda, Awh & Vogel (2014)",
    type: "paper",
  },
  logan1988: {
    title: "Toward an Instance Theory of Automatization — Logan (1988)",
    type: "paper",
  },
  salthouse1996: {
    title: "The Processing-Speed Theory of Adult Age Differences in Cognition — Salthouse (1996)",
    type: "paper",
  },
  schmidt2011: {
    title: "Motor Control and Learning: A Behavioral Emphasis — Schmidt & Lee",
    type: "book",
  },
  mujika2000: {
    title: "Detraining: Loss of Training-Induced Physiological and Performance Adaptations — Mujika & Padilla (2000)",
    type: "paper",
  },
  hillman2008: {
    title: "Be Smart, Exercise Your Heart: Exercise Effects on Brain and Cognition — Hillman, Erickson & Kramer (2008)",
    type: "paper",
  },
  lim2010: {
    title: "A meta-analysis of the impact of short-term sleep deprivation on cognitive variables — Lim & Dinges (2010)",
    type: "paper",
  },
  gross2015: {
    title: "Emotion Regulation: Current Status and Future Prospects — Gross (2015)",
    type: "paper",
  },
  webb2012: {
    title: "Dealing with feeling: A meta-analysis of emotion regulation strategies — Webb, Miles & Sheeran (2012)",
    type: "paper",
  },
  barrett2017: {
    title: "How Emotions Are Made — Lisa Feldman Barrett (2017)",
    type: "book",
  },
  kashdan2015: {
    title: "Unpacking Emotion Differentiation — Kashdan, Barrett & McKnight (2015)",
    type: "paper",
  },
  josephNewman2010: {
    title: "Emotional Intelligence: An Integrative Meta-Analysis — Joseph & Newman (2010)",
    type: "paper",
  },
  ickes1993: {
    title: "Empathic Accuracy — Ickes (1993)",
    type: "paper",
  },
  gollwitzer1999: {
    title: "Implementation Intentions: Strong Effects of Simple Plans — Gollwitzer (1999)",
    type: "paper",
  },
  locke2002: {
    title: "Building a Practically Useful Theory of Goal Setting and Task Motivation — Locke & Latham (2002)",
    type: "paper",
  },
  wood2016: {
    title: "Psychology of Habit — Wood & Rünger (2016)",
    type: "paper",
  },
  mischel1989: {
    title: "Delay of Gratification in Children — Mischel, Shoda & Rodriguez (1989)",
    type: "paper",
  },
  watts2018: {
    title: "Revisiting the Marshmallow Test — Watts, Duncan & Quan (2018)",
    type: "paper",
  },
  kahneman2011: {
    title: "Thinking, Fast and Slow — Kahneman (2011)",
    type: "book",
  },
  morewedge2015: {
    title: "Debiasing Decisions: Improved Decision Making With a Single Training Intervention — Morewedge et al. (2015)",
    type: "paper",
  },
  tetlock2015: {
    title: "Superforecasting: The Art and Science of Prediction — Tetlock & Gardner (2015)",
    type: "book",
  },
  mellers2014: {
    title: "Psychological Strategies for Winning a Geopolitical Forecasting Tournament — Mellers et al. (2014)",
    type: "paper",
  },
  brier1950: {
    title: "Verification of Forecasts Expressed in Terms of Probability — Brier (1950)",
    type: "paper",
  },
  lichtenstein1982: {
    title: "Calibration of Probabilities: The State of the Art to 1980 — Lichtenstein, Fischhoff & Phillips (1982)",
    type: "paper",
  },
  pearl2018: {
    title: "The Book of Why — Pearl & Mackenzie (2018)",
    type: "book",
  },
  mcelreath2020: {
    title: "Statistical Rethinking — McElreath (2020)",
    type: "book",
  },
  ioannidis2005: {
    title: "Why Most Published Research Findings Are False — Ioannidis (2005)",
    type: "paper",
  },
  nosek2015: {
    title: "Estimating the Reproducibility of Psychological Science — Open Science Collaboration (2015)",
    type: "paper",
  },
  wineburg2019: {
    title: "Lateral Reading and the Nature of Expertise — Wineburg & McGrew (2019)",
    type: "paper",
  },
  howard1966: {
    title: "Information Value Theory — Howard (1966)",
    type: "paper",
  },
  kahneman2021: {
    title: "Noise: A Flaw in Human Judgment — Kahneman, Sibony & Sunstein (2021)",
    type: "book",
  },
  savage1954: {
    title: "The Foundations of Statistics — Savage (1954)",
    type: "book",
  },
  runco2012: {
    title: "The Standard Definition of Creativity — Runco & Jaeger (2012)",
    type: "paper",
  },
  guilford1967: {
    title: "The Nature of Human Intelligence — Guilford (1967)",
    type: "book",
  },
  diehl1987: {
    title: "Productivity Loss in Brainstorming Groups — Diehl & Stroebe (1987)",
    type: "paper",
  },
  baer2015: {
    title: "Domain Specificity of Creativity — Baer (2015)",
    type: "book",
  },
  finke1992: {
    title: "Creative Cognition: Theory, Research, and Applications — Finke, Ward & Smith (1992)",
    type: "book",
  },
  risko2016: {
    title: "Cognitive Offloading — Risko & Gilbert (2016)",
    type: "paper",
  },
  sparrow2011: {
    title: "Google Effects on Memory — Sparrow, Liu & Wegner (2011)",
    type: "paper",
  },
  dellacqua2023: {
    title: "Navigating the Jagged Technological Frontier — Dell'Acqua et al. (2023)",
    type: "paper",
  },
  buccinca2021: {
    title: "To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI — Buçinca, Malaya & Gajos (2021)",
    type: "paper",
  },
  polya1945: {
    title: "How to Solve It — Pólya (1945)",
    type: "book",
  },
  newell1972: {
    title: "Human Problem Solving — Newell & Simon (1972)",
    type: "book",
  },
  klein1998: {
    title: "Sources of Power: How People Make Decisions — Klein (1998)",
    type: "book",
  },
  kluger1996: {
    title: "The Effects of Feedback Interventions on Performance — Kluger & DeNisi (1996)",
    type: "paper",
  },
  hattie2007: {
    title: "The Power of Feedback — Hattie & Timperley (2007)",
    type: "paper",
  },
  vanmerrienboer2005: {
    title: "Cognitive Load Theory and Complex Learning — van Merriënboer & Sweller (2005)",
    type: "paper",
  },
  sweller1988: {
    title: "Cognitive Load During Problem Solving — Sweller (1988)",
    type: "paper",
  },
  flavell1979: {
    title: "Metacognition and Cognitive Monitoring — Flavell (1979)",
    type: "paper",
  },
  dunning2011: {
    title: "The Dunning–Kruger Effect: On Being Ignorant of One's Own Ignorance — Dunning (2011)",
    type: "paper",
  },
  schoen2013: {
    title: "Learning by Thinking: How Reflection Aids Performance — Di Stefano, Gino, Pisano & Staats (2016)",
    type: "paper",
  },
  fischer2019: {
    title: "Scenario Planning: Strategic Conversation — van der Heijden (2005)",
    type: "book",
  },
  rumelt2011: {
    title: "Good Strategy / Bad Strategy — Rumelt (2011)",
    type: "book",
  },
  meadows2008: {
    title: "Thinking in Systems — Meadows (2008)",
    type: "book",
  },
  flyvbjerg2006: {
    title: "From Nobel Prize to Project Management: Getting Risks Right — Flyvbjerg (2006)",
    type: "paper",
  },
  graber2012: {
    title: "Cognitive interventions to reduce diagnostic error — Graber et al. (2012)",
    type: "paper",
  },
  kellman2009: {
    title: "Perceptual Learning and the Technology of Expertise — Kellman & Garrigan (2009)",
    type: "paper",
  },
  uttal2013: {
    title: "The Malleability of Spatial Skills: A Meta-Analysis of Training Studies — Uttal et al. (2013)",
    type: "paper",
  },
  shepard1971: {
    title: "Mental Rotation of Three-Dimensional Objects — Shepard & Metzler (1971)",
    type: "paper",
  },
  larkin1987: {
    title: "Why a Diagram Is (Sometimes) Worth Ten Thousand Words — Larkin & Simon (1987)",
    type: "paper",
  },
  edwards2012: {
    title: "Drawing on the Right Side of the Brain — Edwards (2012)",
    type: "book",
  },
  micheyl2006: {
    title: "Influence of musical and psychoacoustical training on pitch discrimination — Micheyl et al. (2006)",
    type: "paper",
  },
  repp2013: {
    title: "Sensorimotor synchronization: A review of recent research — Repp & Su (2013)",
    type: "paper",
  },
  sala2017music: {
    title: "When the Music's Over: Does Music Skill Transfer to Children's and Young Adolescents' Cognitive and Academic Skills? — Sala & Gobet (2017)",
    type: "paper",
  },
  berkowitz2010: {
    title: "The Neural Correlates of Musical Improvisation — Berkowitz & Ansari (2010)",
    type: "paper",
  },
  atkinson2011: {
    title: "Navigation and the hippocampus — Maguire et al. (2000), London taxi drivers",
    type: "paper",
  },
  gooley2011: {
    title: "The Natural Navigator — Tristan Gooley (2010)",
    type: "book",
  },
  atran1998: {
    title: "Folk Biology and the Anthropology of Science — Atran (1998)",
    type: "paper",
  },
  wolfe2010: {
    title: "Visual search — Wolfe (2010)",
    type: "paper",
  },
  graham2008: {
    title: "A Meta-Analysis of Writing Instruction for Adolescent Students — Graham & Perin (2007)",
    type: "paper",
  },
  nation2013: {
    title: "Learning Vocabulary in Another Language — Nation (2013)",
    type: "book",
  },
  willingham2017: {
    title: "The Reading Mind — Willingham (2017)",
    type: "book",
  },
  fisher2011: {
    title: "Getting to Yes: Negotiating Agreement Without Giving In — Fisher & Ury",
    type: "book",
  },
  thompson2020: {
    title: "The Mind and Heart of the Negotiator — Thompson (2020)",
    type: "book",
  },
  fiorella2016: {
    title: "Learning by Teaching: The Protégé Effect — Fiorella & Mayer (2016)",
    type: "paper",
  },
  rogers1957: {
    title: "Active Listening — Rogers & Farson (1957)",
    type: "paper",
  },
  ambady1992: {
    title: "Thin Slices of Expressive Behavior as Predictors of Interpersonal Consequences — Ambady & Rosenthal (1992)",
    type: "paper",
  },
  hall2009: {
    title: "Accuracy of Judging Others' Nonverbal Cues — Hall, Andrzejewski & Yopchick (2009)",
    type: "paper",
  },
  yeager2019: {
    title: "A national experiment reveals where a growth mindset improves achievement — Yeager et al. (2019)",
    type: "paper",
  },
  sisk2018: {
    title: "To What Extent and Under Which Circumstances Are Growth Mind-Sets Important to Academic Achievement? — Sisk et al. (2018)",
    type: "paper",
  },
  mrazek2013: {
    title: "Mindfulness Training Improves Working Memory Capacity and GRE Performance — Mrazek et al. (2013)",
    type: "paper",
  },
  vandam2016: {
    title: "Mind the Hype: A Critical Evaluation of Mindfulness Research — Van Dam et al. (2018)",
    type: "paper",
  },
  farb2015: {
    title: "Interoception, contemplative practice, and health — Farb et al. (2015)",
    type: "paper",
  },
  gawande2009: {
    title: "The Checklist Manifesto — Gawande (2009)",
    type: "book",
  },
  ahrens2017: {
    title: "How to Take Smart Notes — Ahrens (2017)",
    type: "book",
  },
  bloom1984: {
    title: "The 2 Sigma Problem — Bloom (1984)",
    type: "paper",
  },
  tulving1972: {
    title: "Episodic and Semantic Memory — Tulving (1972)",
    type: "paper",
  },
  kruger1999: {
    title: "Unskilled and Unaware of It — Kruger & Dunning (1999)",
    type: "paper",
  },
  ophir2009: {
    title: "Cognitive control in media multitaskers — Ophir, Nass & Wagner (2009)",
    type: "paper",
  },
  ratcliff2008: {
    title: "The Diffusion Decision Model — Ratcliff & McKoon (2008)",
    type: "paper",
  },
  heitz2014: {
    title: "The speed-accuracy tradeoff: history, physiology, methodology, and behavior — Heitz (2014)",
    type: "paper",
  },
  markman2013: {
    title: "Analogy as the Core of Cognition — Gentner (2003)",
    type: "paper",
  },
  gick1983: {
    title: "Schema Induction and Analogical Transfer — Gick & Holyoak (1983)",
    type: "paper",
  },
  hofstadter2013: {
    title: "Surfaces and Essences: Analogy as the Fuel and Fire of Thinking — Hofstadter & Sander (2013)",
    type: "book",
  },
  mayo1996: {
    title: "Error and the Growth of Experimental Knowledge — Mayo (1996)",
    type: "book",
  },
  popper1959: {
    title: "The Logic of Scientific Discovery — Popper (1959)",
    type: "book",
  },
  wason1968: {
    title: "Reasoning about a rule — Wason (1968)",
    type: "paper",
  },
  gigerenzer1995: {
    title: "How to Improve Bayesian Reasoning Without Instruction: Frequency Formats — Gigerenzer & Hoffrage (1995)",
    type: "paper",
  },
  lewis1990: {
    title: "The Art of Insight in Science and Engineering — Mahajan (2014)",
    type: "book",
  },
  hoffrage2000: {
    title: "Communicating Statistical Information — Hoffrage, Lindsey, Hertwig & Gigerenzer (2000)",
    type: "paper",
  },
  tufte2001: {
    title: "The Visual Display of Quantitative Information — Tufte (2001)",
    type: "book",
  },
  hattie2016: {
    title: "Learning Strategies: A Synthesis and Conceptual Model — Hattie & Donoghue (2016)",
    type: "paper",
  },
  kornell2007: {
    title: "The promise and perils of self-regulated study — Kornell & Bjork (2007)",
    type: "paper",
  },
  metcalfe2009: {
    title: "Metacognitive judgments and control of study — Metcalfe & Finn (2009)",
    type: "paper",
  },
  vygotsky1978: {
    title: "Mind in Society — Vygotsky (1978)",
    type: "book",
  },
  clark1998: {
    title: "The Extended Mind — Clark & Chalmers (1998)",
    type: "paper",
  },
};

/** Resolve citation keys to the Resource shape stored on nodes. */
export function cite(keys) {
  return keys.map((key) => {
    const entry = CITATIONS[key];
    if (!entry) throw new Error(`unknown citation key: ${key}`);
    return entry.url
      ? { title: entry.title, type: entry.type, url: entry.url }
      : { title: entry.title, type: entry.type };
  });
}
