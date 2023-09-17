using ParseDocs;
using ParseDocs.Models;
using System.CommandLine;
using System.CommandLine.Invocation;
using System.CommandLine.Parsing;
using Parser = ParseDocs.Parser;


var rootCommand = new RootCommand("Generated the YAFP data from parsed Satisfactory docs");
var inputOption = new Option<DirectoryInfo>(
    aliases: new[] {"--input","-i"},
isDefault: true,
parseArgument: result => new DirectoryInfo(result.Tokens.Single().Value),
    description: "The path to the parsed output of the Docs.json file.");
var outputOption = new Option<DirectoryInfo>(
    aliases: new[] { "--output", "-o" },
    parseArgument: result => new DirectoryInfo(result.Tokens.Single().Value),
    description: "The path to save the YAFP object outputs.");

rootCommand.AddOption(inputOption);
rootCommand.AddOption(outputOption);

rootCommand.SetHandler(Parser.Run, inputOption, outputOption);

await rootCommand.InvokeAsync(args);

public sealed partial class Program { }