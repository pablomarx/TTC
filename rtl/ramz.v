`timescale 1ns / 1ps 
module ramz(
	input clka,
	input [4:0] addra,
	input wea,
	input [31:0] dina,
	
	input clkb,
	input [4:0] addrb,
	output reg [31:0] doutb
);

reg [31:0] mem[31:0];

always @(posedge clka) begin
	if (wea) begin
		mem[addra] <= dina;
	end
end

always @(posedge clkb) begin
	doutb <= mem[addrb];
end

endmodule
 
