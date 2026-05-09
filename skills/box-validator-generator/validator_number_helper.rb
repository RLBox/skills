# frozen_string_literal: true

# 辅助工具：Validator 编号管理（多项目通用）
#
# 使用示例：
#   require_relative 'validator_number_helper'
#   helper = ValidatorNumberHelper.new('/path/to/app/validators')
#   helper.find_next_number('post')                # => "009"
#   helper.number_exists?('post', '003')           # => true/false
#   helper.get_available_number('post', '003')     # => { number: "004", conflict: true, message: "..." }
#
# 文件路径格式：
#   app/validators/{module}/v{NNN}_{module}_validator.rb
#
# 类名格式（Zeitwerk）：
#   Validators::{Module}::V{NNN}{Module}Validator

require 'pathname'

class ValidatorNumberHelper
  # 计算 IdleSwap 项目的 app/validators 绝对路径
  def self.default_validators_root
    # 环境变量优先（CI / 脚本外部调用）
    return File.join(ENV['IDLESWAP_ROOT'], 'app', 'validators') if ENV['IDLESWAP_ROOT']

    # 本文件位于 .clacky/skills/box-validator-generator/validator_number_helper.rb
    # 需要找到项目根（往上查找 Gemfile）
    here = Pathname.new(__FILE__).realpath.parent
    candidate = here
    until candidate.root?
      return (candidate + 'app' + 'validators').to_s if (candidate + 'Gemfile').exist?
      candidate = candidate.parent
    end

    # Fallback: 当前目录下的 app/validators
    File.join(Dir.pwd, 'app', 'validators')
  end

  VALIDATORS_ROOT = default_validators_root

  def initialize(root_path = VALIDATORS_ROOT)
    @root_path = root_path
  end

  # 扫描模块目录，获取下一个可用编号
  #   find_next_number('post') => "009"
  def find_next_number(module_name)
    module_dir = File.join(@root_path, module_name)
    return '001' unless Dir.exist?(module_dir)

    pattern = File.join(module_dir, "v*_#{module_name}_validator.rb")
    numbers = Dir.glob(pattern).map do |file|
      basename = File.basename(file, '.rb')
      match = basename.match(/^v(\d{3})_#{Regexp.escape(module_name)}_validator$/)
      match ? match[1].to_i : nil
    end.compact

    next_number = numbers.empty? ? 1 : numbers.max + 1
    format('%03d', next_number)
  end

  # 判断指定编号是否已存在
  def number_exists?(module_name, number)
    File.exist?(file_path_for(module_name, number))
  end

  # 获取可用编号（冲突时自动递增）
  #   get_available_number('post', '003')
  #   => { number: "003", conflict: false }
  #   => { number: "004", conflict: true, message: "编号 003 已存在，已自动递增到 004" }
  def get_available_number(module_name, requested_number)
    padded = format('%03d', requested_number.to_i)

    unless number_exists?(module_name, padded)
      return { number: padded, conflict: false }
    end

    # 冲突：找下一个可用编号
    next_num = find_next_number(module_name)
    {
      number: next_num,
      conflict: true,
      message: "编号 #{padded} 已存在，已自动递增到 #{next_num}"
    }
  end

  # 列出模块下所有已有编号
  def list_numbers(module_name)
    module_dir = File.join(@root_path, module_name)
    return [] unless Dir.exist?(module_dir)

    pattern = File.join(module_dir, "v*_#{module_name}_validator.rb")
    Dir.glob(pattern).map do |file|
      basename = File.basename(file, '.rb')
      match = basename.match(/^v(\d{3})_#{Regexp.escape(module_name)}_validator$/)
      match ? match[1] : nil
    end.compact.sort
  end

  # 列出所有已知模块
  def list_modules
    return [] unless Dir.exist?(@root_path)

    Dir.children(@root_path)
       .select { |d| File.directory?(File.join(@root_path, d)) }
       .reject { |d| d.start_with?('.') || d == 'support' }
       .sort
  end

  # 生成文件路径
  def file_path_for(module_name, number)
    padded = format('%03d', number.to_i)
    File.join(@root_path, module_name, "v#{padded}_#{module_name}_validator.rb")
  end

  # 生成类名（Zeitwerk 格式）
  #   class_name_for('comment', '001') => "Validators::Comment::V001CommentValidator"
  def class_name_for(module_name, number)
    padded = format('%03d', number.to_i)
    module_class = module_name.capitalize
    "Validators::#{module_class}::V#{padded}#{module_class}Validator"
  end

  # 生成 validator_id（带模块前缀）
  #   validator_id_for('comment', '001') => "comment/v001_comment_validator"
  def validator_id_for(module_name, number)
    padded = format('%03d', number.to_i)
    "#{module_name}/v#{padded}_#{module_name}_validator"
  end

  # 汇总信息（调试用）
  def summary
    modules = list_modules
    info = modules.map do |mod|
      nums = list_numbers(mod)
      "#{mod}: #{nums.length} validators (#{nums.join(', ')})"
    end

    {
      root: @root_path,
      modules: modules,
      details: info
    }
  end
end
