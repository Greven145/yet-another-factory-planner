using ParseDocs;
using ParseDocs.Models;
using System.CommandLine;

var inputOption = new Option<DirectoryInfo>("--input", "-i")
{
    Description = "The path to the parsed output of the Docs.json file."
};
var outputOption = new Option<DirectoryInfo>("--output", "-o")
{
    Description = "The path to save the YAFP object outputs."
};

var rootCommand = new RootCommand("Generated the YAFP data from parsed Satisfactory docs");
rootCommand.Add(inputOption);
rootCommand.Add(outputOption);

rootCommand.SetAction(async parseResult =>
{
    var inputDir = parseResult.GetValue(inputOption);
    var outputDir = parseResult.GetValue(outputOption);
    if (inputDir != null && outputDir != null)
    {
        await Parser.Run(inputDir, outputDir);
    }
    return 0;
});

return rootCommand.Parse(args).Invoke();

public sealed partial class Program { }