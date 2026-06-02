
export interface SnowflakeParams {
  branchCount: number;
  branchLength: number;
  subBranchAngle: number;
  subBranchLength: number;
  subBranchDensity: number;
  lineWidth: number;
  glowSize: number;
  color: string;
}

export interface PRNG {
  next: () => number;
}
