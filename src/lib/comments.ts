export type GiscusConfig = {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
};

export function readGiscusConfig(env: Record<string, string | undefined>): GiscusConfig | null {
  const repo = env.PUBLIC_GISCUS_REPO?.trim();
  const repoId = env.PUBLIC_GISCUS_REPO_ID?.trim();
  const category = env.PUBLIC_GISCUS_CATEGORY?.trim();
  const categoryId = env.PUBLIC_GISCUS_CATEGORY_ID?.trim();

  if (!repo || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo) || !repoId || !category || !categoryId) {
    return null;
  }

  return { repo, repoId, category, categoryId };
}

export function giscusAttributes(config: GiscusConfig): Record<string, string> {
  return {
    'data-repo': config.repo,
    'data-repo-id': config.repoId,
    'data-category': config.category,
    'data-category-id': config.categoryId,
    'data-mapping': 'pathname',
    'data-strict': '1',
    'data-lang': 'zh-CN',
  };
}
