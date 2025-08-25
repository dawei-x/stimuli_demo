// Edit these values as needed
window.DEMO_CONFIG = {
  // Regioned S3 manifest URL:
  MANIFEST_URL: 'https://conformal-stimuli.s3.us-east-2.amazonaws.com/manifests/stimuli.json',

  // Which tab to show first: 'sample' or 'browse'
  DEFAULT_TAB: 'sample',

  // Sidebar blurb
  MODEL_INFO: {
    model: 'Wide-ResNet-101-2',
    extractor: 'Wide-ResNet-101-2',
    representative: 'embedding-centroid',
    coverage_label: '90%',
    alpha: 0.10,
    data: 'ImageNet (demo use only)'
  }
};
