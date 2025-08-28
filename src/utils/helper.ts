export class Helper {
  public static getDepthByRating(rating: number): number {
    if (rating < 800) return 4;
    if (rating < 1200) return 6;
    if (rating < 1600) return 8;
    if (rating < 2000) return 10;
    return 14;
  }
}
