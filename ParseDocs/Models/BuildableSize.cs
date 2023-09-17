namespace ParseDocs.Models;

public class BuildableSize
{
    public decimal Width { get; set; }
    public decimal Height { get; set; }
    public decimal Length { get; set; }
    public void Deconstruct(out decimal width, out decimal height, out decimal length) => (width, height, length) = (Width, Height, Length);
}